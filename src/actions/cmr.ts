'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import { CmrPDF, type CmrPdfData } from '@/lib/pdf/cmr-generator'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher'] as const

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}
type AuthCheck = AuthOk | { ok: false; error: string }

async function ensureBackOffice(): Promise<AuthCheck> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

function isWriter(role: string): boolean {
  return WRITE_ROLES.includes(role as (typeof WRITE_ROLES)[number])
}

// ============================================================
// Auto-create or fetch a CMR for an international shipment.
//
// Idempotent: if a CMR already exists for the shipment, return its id.
// Otherwise build one from shipment + company + client data, with
// every box pre-filled to the best of the system's knowledge. The
// dispatcher then reviews and edits before issuing.
// ============================================================
export async function createOrGetCmrForShipment(
  shipmentId: string,
): Promise<ActionResult<{ cmrId: string; cmrNumber: string; created: boolean }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }
  if (!z.string().uuid().safeParse(shipmentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()

  // Check if a CMR already exists (cheap lookup before fetching shipment)
  const { data: existing } = await supabase
    .from('cmr_documents')
    .select('id, cmr_number')
    .eq('shipment_id', shipmentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (existing) {
    type CmrLite = { id: string; cmr_number: string }
    const e = existing as unknown as CmrLite
    return { data: { cmrId: e.id, cmrNumber: e.cmr_number, created: false }, error: null }
  }

  // Fetch shipment + company + client to seed the boxes
  const [{ data: shipment }, { data: company }] = await Promise.all([
    supabase
      .from('shipments')
      .select(
        'id, reference, is_international, pickup_street, pickup_city, pickup_country, pickup_scheduled_at, delivery_street, delivery_city, delivery_country, weight_kg, volume_m3, description, customs_hs_code, price_excl_tax, client:clients(business_name, address, city, country, tax_id), assigned_vehicle:vehicles(plate_number), assigned_driver:drivers(full_name)',
      )
      .eq('id', shipmentId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('name, address, city, country, tax_id, slug')
      .eq('id', auth.companyId)
      .maybeSingle(),
  ])
  if (!shipment) return { data: null, error: 'Mission introuvable.' }
  if (!company) return { data: null, error: 'Entreprise introuvable.' }

  type ShipmentRow = {
    id: string
    reference: string
    is_international: boolean
    pickup_street: string
    pickup_city: string
    pickup_country: string
    pickup_scheduled_at: string | null
    delivery_street: string
    delivery_city: string
    delivery_country: string
    weight_kg: number | string | null
    volume_m3: number | string | null
    description: string | null
    customs_hs_code: string | null
    price_excl_tax: number | string | null
    client: {
      business_name: string
      address: string | null
      city: string | null
      country: string
      tax_id: string | null
    } | null
    assigned_vehicle: { plate_number: string } | null
    assigned_driver: { full_name: string } | null
  }
  type CompanyRow = {
    name: string
    address: string | null
    city: string | null
    country: string
    tax_id: string | null
    slug: string
  }
  const s = shipment as unknown as ShipmentRow
  const c = company as unknown as CompanyRow

  // CMR is for international shipments. We don't hard-block non-international
  // ones (the user might want to issue a CMR ahead of flipping the flag) but
  // we surface a soft warning via internal_notes.
  const internalNote = s.is_international
    ? null
    : 'Mission marquée non-internationale — CMR émis manuellement.'

  // Allocate CMR number
  const { data: seqValue, error: seqError } = await supabase.rpc('next_sequence_value', {
    p_company_id: auth.companyId,
    p_type: 'cmr',
  })
  if (seqError || typeof seqValue !== 'number') {
    logger.error('cmr.seq_failed', { error: seqError?.message ?? 'sequence missing' })
    return { data: null, error: 'Échec de l\'attribution du numéro de CMR.' }
  }
  const yearShort = new Date().getFullYear().toString().slice(-2)
  const padded = String(seqValue).padStart(5, '0')
  const cmrNumber = `${c.slug.toUpperCase()}-CMR-${yearShort}-${padded}`

  // Pre-fill: assume the carrier's company is the consigner (sender) only
  // if the route ORIGINATES in the company country; otherwise the client
  // is sender. Default: client = sender, carrier = us. This matches the
  // typical export flow (Maroc → UE).
  const cmrId = crypto.randomUUID()
  const { error: insertError } = await supabase.from('cmr_documents').insert({
    id: cmrId,
    company_id: auth.companyId,
    shipment_id: shipmentId,
    cmr_number: cmrNumber,
    status: 'draft',

    // Box 1 — Sender = the client (the one whose goods are moving)
    sender_name: s.client?.business_name ?? '',
    sender_address: s.client?.address ?? s.pickup_street,
    sender_city: s.client?.city ?? s.pickup_city,
    sender_country: s.client?.country ?? s.pickup_country,
    sender_ice: s.client?.tax_id ?? null,

    // Box 2 — Consignee. We don't know it yet — dispatcher fills it in.
    consignee_name: '',
    consignee_address: s.delivery_street,
    consignee_city: s.delivery_city,
    consignee_country: s.delivery_country,
    consignee_ice: null,

    // Box 3 + 4
    delivery_place: `${s.delivery_street}, ${s.delivery_city}`,
    delivery_country: s.delivery_country,
    taking_over_place: `${s.pickup_street}, ${s.pickup_city}`,
    taking_over_country: s.pickup_country,
    taking_over_date: s.pickup_scheduled_at ? s.pickup_scheduled_at.slice(0, 10) : null,

    // Boxes 6-12
    nature_of_goods: s.description ?? '—',
    statistical_number: s.customs_hs_code,
    gross_weight_kg: s.weight_kg == null ? null : Number(s.weight_kg),
    volume_m3: s.volume_m3 == null ? null : Number(s.volume_m3),

    // Box 14 — Carrier = our company
    carrier_name: c.name,
    carrier_address: c.address,
    carrier_country: c.country,
    carrier_ice: c.tax_id,
    carrier_vehicle_plate: s.assigned_vehicle?.plate_number ?? null,
    carrier_driver_name: s.assigned_driver?.full_name ?? null,

    // Box 18 — Charges. Pre-fill from price_excl_tax as the freight charge.
    charges_freight_mad: s.price_excl_tax == null ? null : Number(s.price_excl_tax),
    payer: 'sender',

    // Box 20
    issued_place: c.city ?? '—',
    issued_date: new Date().toISOString().slice(0, 10),

    internal_notes: internalNote,
    created_by_user_id: auth.user.id,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { data: null, error: 'Une CMR existe déjà pour cette mission.' }
    }
    logger.error('cmr.create_failed', {
      action: 'createOrGetCmrForShipment',
      shipmentId,
      error: insertError.message,
    })
    return { data: null, error: 'Échec de la création de la CMR.' }
  }

  // Back-link
  await supabase
    .from('shipments')
    .update({ cmr_document_id: cmrId })
    .eq('id', shipmentId)
    .eq('company_id', auth.companyId)

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'cmr_document',
    entityId: cmrId,
    action: 'create',
    afterState: { cmr_number: cmrNumber, shipment_reference: s.reference },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/cmr', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { data: { cmrId, cmrNumber, created: true }, error: null }
}

// ============================================================
// Update CMR boxes (only allowed in draft status)
// ============================================================
const updateSchema = z.object({
  // Box 1
  senderName: z.string().trim().min(1).max(160),
  senderAddress: z.string().trim().min(1).max(255),
  senderCity: z.string().trim().min(1).max(80),
  senderCountry: z.string().trim().length(2),
  senderIce: z.string().trim().max(40).nullable().optional(),
  // Box 2
  consigneeName: z.string().trim().min(1).max(160),
  consigneeAddress: z.string().trim().min(1).max(255),
  consigneeCity: z.string().trim().min(1).max(80),
  consigneeCountry: z.string().trim().length(2),
  consigneeIce: z.string().trim().max(40).nullable().optional(),
  // Box 3 + 4
  deliveryPlace: z.string().trim().min(1).max(255),
  deliveryCountry: z.string().trim().length(2),
  takingOverPlace: z.string().trim().min(1).max(255),
  takingOverCountry: z.string().trim().length(2),
  takingOverDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .nullable()
    .optional(),
  // Box 5
  attachedDocuments: z.string().trim().max(500).nullable().optional(),
  // Boxes 6-12
  marksAndNumbers: z.string().trim().max(160).nullable().optional(),
  packagesCount: z.coerce.number().int().nonnegative().nullable().optional(),
  packingMethod: z.string().trim().max(80).nullable().optional(),
  natureOfGoods: z.string().trim().min(1).max(500),
  statisticalNumber: z.string().trim().max(40).nullable().optional(),
  grossWeightKg: z.coerce.number().nonnegative().nullable().optional(),
  volumeM3: z.coerce.number().nonnegative().nullable().optional(),
  // Box 13
  senderInstructions: z.string().trim().max(1000).nullable().optional(),
  // Box 14
  carrierName: z.string().trim().min(1).max(160),
  carrierAddress: z.string().trim().max(255).nullable().optional(),
  carrierCountry: z.string().trim().length(2),
  carrierIce: z.string().trim().max(40).nullable().optional(),
  carrierVehiclePlate: z.string().trim().max(20).nullable().optional(),
  carrierTrailerPlate: z.string().trim().max(20).nullable().optional(),
  carrierDriverName: z.string().trim().max(120).nullable().optional(),
  // Box 15 + 16
  successiveCarriers: z.string().trim().max(500).nullable().optional(),
  carrierObservations: z.string().trim().max(1000).nullable().optional(),
  // Box 18 charges
  chargesFreightMad: z.coerce.number().nonnegative().nullable().optional(),
  chargesSupplementaryMad: z.coerce.number().nonnegative().nullable().optional(),
  chargesCustomsMad: z.coerce.number().nonnegative().nullable().optional(),
  chargesOtherMad: z.coerce.number().nonnegative().nullable().optional(),
  payer: z.enum(['sender', 'consignee', 'split']),
  // Box 19
  cashOnDeliveryMad: z.coerce.number().nonnegative().nullable().optional(),
  // Box 20
  issuedPlace: z.string().trim().min(1).max(80),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  // Box 21
  specialAgreements: z.string().trim().max(1000).nullable().optional(),
  // internal
  internalNotes: z.string().trim().max(1000).nullable().optional(),
})

export type CmrUpdateInput = z.input<typeof updateSchema>

export async function updateCmr(
  cmrId: string,
  rawInput: CmrUpdateInput,
): Promise<ActionResult<{ cmrId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }
  if (!z.string().uuid().safeParse(cmrId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = updateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('cmr_documents')
    .select('id, status, cmr_number')
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'CMR introuvable.' }
  type CmrLite = { id: string; status: string; cmr_number: string }
  const before = existing as unknown as CmrLite
  if (before.status === 'signed' || before.status === 'cancelled') {
    return { data: null, error: 'CMR verrouillée — édition impossible.' }
  }

  const { error } = await supabase
    .from('cmr_documents')
    .update({
      sender_name: input.senderName,
      sender_address: input.senderAddress,
      sender_city: input.senderCity,
      sender_country: input.senderCountry,
      sender_ice: input.senderIce ?? null,
      consignee_name: input.consigneeName,
      consignee_address: input.consigneeAddress,
      consignee_city: input.consigneeCity,
      consignee_country: input.consigneeCountry,
      consignee_ice: input.consigneeIce ?? null,
      delivery_place: input.deliveryPlace,
      delivery_country: input.deliveryCountry,
      taking_over_place: input.takingOverPlace,
      taking_over_country: input.takingOverCountry,
      taking_over_date: input.takingOverDate ?? null,
      attached_documents: input.attachedDocuments ?? null,
      marks_and_numbers: input.marksAndNumbers ?? null,
      packages_count: input.packagesCount ?? null,
      packing_method: input.packingMethod ?? null,
      nature_of_goods: input.natureOfGoods,
      statistical_number: input.statisticalNumber ?? null,
      gross_weight_kg: input.grossWeightKg ?? null,
      volume_m3: input.volumeM3 ?? null,
      sender_instructions: input.senderInstructions ?? null,
      carrier_name: input.carrierName,
      carrier_address: input.carrierAddress ?? null,
      carrier_country: input.carrierCountry,
      carrier_ice: input.carrierIce ?? null,
      carrier_vehicle_plate: input.carrierVehiclePlate ?? null,
      carrier_trailer_plate: input.carrierTrailerPlate ?? null,
      carrier_driver_name: input.carrierDriverName ?? null,
      successive_carriers: input.successiveCarriers ?? null,
      carrier_observations: input.carrierObservations ?? null,
      charges_freight_mad: input.chargesFreightMad ?? null,
      charges_supplementary_mad: input.chargesSupplementaryMad ?? null,
      charges_customs_mad: input.chargesCustomsMad ?? null,
      charges_other_mad: input.chargesOtherMad ?? null,
      payer: input.payer,
      cash_on_delivery_mad: input.cashOnDeliveryMad ?? null,
      issued_place: input.issuedPlace,
      issued_date: input.issuedDate,
      special_agreements: input.specialAgreements ?? null,
      internal_notes: input.internalNotes ?? null,
    })
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la mise à jour.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'cmr_document',
    entityId: cmrId,
    action: 'update',
    beforeState: { cmr_number: before.cmr_number, status: before.status },
    afterState: {
      cmr_number: before.cmr_number,
      consignee_name: input.consigneeName,
      delivery_place: input.deliveryPlace,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/cmr', 'page')
  revalidatePath(`/[locale]/(dashboard)/cmr/${cmrId}`, 'page')
  return { data: { cmrId }, error: null }
}

// ============================================================
// Render PDF + upload to Storage. Sets status → 'issued' on first
// successful render. Idempotent — safe to re-render after edits.
// ============================================================
async function buildCmrPdf(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  companyId: string,
  cmrId: string,
): Promise<{ buffer: Buffer; cmrNumber: string; path: string } | { error: string }> {
  const { data: row } = await service
    .from('cmr_documents')
    .select(
      'id, cmr_number, status, sender_name, sender_address, sender_city, sender_country, sender_ice, consignee_name, consignee_address, consignee_city, consignee_country, consignee_ice, delivery_place, delivery_country, taking_over_place, taking_over_country, taking_over_date, attached_documents, marks_and_numbers, packages_count, packing_method, nature_of_goods, statistical_number, gross_weight_kg, volume_m3, sender_instructions, carrier_name, carrier_address, carrier_country, carrier_ice, carrier_vehicle_plate, carrier_trailer_plate, carrier_driver_name, successive_carriers, carrier_observations, charges_freight_mad, charges_supplementary_mad, charges_customs_mad, charges_other_mad, charges_total_mad, payer, cash_on_delivery_mad, issued_place, issued_date, special_agreements, signature_sender_place, signature_sender_date, signature_carrier_place, signature_carrier_date, signature_consignee_place, signature_consignee_date',
    )
    .eq('id', cmrId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!row) return { error: 'CMR introuvable.' }

  const r = row as unknown as Record<string, unknown>

  const pdfData: CmrPdfData = {
    cmrNumber: r.cmr_number as string,
    status: r.status as CmrPdfData['status'],
    sender: {
      name: r.sender_name as string,
      address: r.sender_address as string,
      city: r.sender_city as string,
      country: r.sender_country as string,
      ice: (r.sender_ice as string | null) ?? null,
    },
    consignee: {
      name: r.consignee_name as string,
      address: r.consignee_address as string,
      city: r.consignee_city as string,
      country: r.consignee_country as string,
      ice: (r.consignee_ice as string | null) ?? null,
    },
    deliveryPlace: r.delivery_place as string,
    deliveryCountry: r.delivery_country as string,
    takingOverPlace: r.taking_over_place as string,
    takingOverCountry: r.taking_over_country as string,
    takingOverDate: (r.taking_over_date as string | null) ?? null,
    attachedDocuments: (r.attached_documents as string | null) ?? null,
    goods: {
      marksAndNumbers: (r.marks_and_numbers as string | null) ?? null,
      packagesCount: (r.packages_count as number | null) ?? null,
      packingMethod: (r.packing_method as string | null) ?? null,
      natureOfGoods: r.nature_of_goods as string,
      statisticalNumber: (r.statistical_number as string | null) ?? null,
      grossWeightKg: r.gross_weight_kg == null ? null : Number(r.gross_weight_kg),
      volumeM3: r.volume_m3 == null ? null : Number(r.volume_m3),
    },
    senderInstructions: (r.sender_instructions as string | null) ?? null,
    carrier: {
      name: r.carrier_name as string,
      address: (r.carrier_address as string | null) ?? null,
      country: r.carrier_country as string,
      ice: (r.carrier_ice as string | null) ?? null,
      vehiclePlate: (r.carrier_vehicle_plate as string | null) ?? null,
      trailerPlate: (r.carrier_trailer_plate as string | null) ?? null,
      driverName: (r.carrier_driver_name as string | null) ?? null,
    },
    successiveCarriers: (r.successive_carriers as string | null) ?? null,
    carrierObservations: (r.carrier_observations as string | null) ?? null,
    charges: {
      freight: r.charges_freight_mad == null ? null : Number(r.charges_freight_mad),
      supplementary:
        r.charges_supplementary_mad == null ? null : Number(r.charges_supplementary_mad),
      customs: r.charges_customs_mad == null ? null : Number(r.charges_customs_mad),
      other: r.charges_other_mad == null ? null : Number(r.charges_other_mad),
      total: r.charges_total_mad == null ? null : Number(r.charges_total_mad),
      payer: r.payer as 'sender' | 'consignee' | 'split',
    },
    cashOnDelivery: r.cash_on_delivery_mad == null ? null : Number(r.cash_on_delivery_mad),
    issuedPlace: r.issued_place as string,
    issuedDate: r.issued_date as string,
    specialAgreements: (r.special_agreements as string | null) ?? null,
    signatures: {
      sender: {
        place: (r.signature_sender_place as string | null) ?? null,
        date: (r.signature_sender_date as string | null) ?? null,
      },
      carrier: {
        place: (r.signature_carrier_place as string | null) ?? null,
        date: (r.signature_carrier_date as string | null) ?? null,
      },
      consignee: {
        place: (r.signature_consignee_place as string | null) ?? null,
        date: (r.signature_consignee_date as string | null) ?? null,
      },
    },
  }

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(CmrPDF({ data: pdfData }))
  } catch (err) {
    logger.error('cmr.pdf_render_failed', {
      cmrId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { error: 'Échec de la génération du PDF.' }
  }

  const path = `${companyId}/${cmrId}/${pdfData.cmrNumber}.pdf`
  return { buffer, cmrNumber: pdfData.cmrNumber, path }
}

export async function generateCmrPdf(
  cmrId: string,
): Promise<ActionResult<{ cmrId: string; pdfPath: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }
  if (!z.string().uuid().safeParse(cmrId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const service = await createServiceClient()
  const built = await buildCmrPdf(service, auth.companyId, cmrId)
  if ('error' in built) return { data: null, error: built.error }

  const { error: uploadError } = await service.storage
    .from('cmr-documents')
    .upload(built.path, built.buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    logger.error('cmr.pdf_upload_failed', { cmrId, error: uploadError.message })
    return { data: null, error: 'Échec du téléversement du PDF.' }
  }

  // Promote draft → issued on first generation
  const { data: existing } = await service
    .from('cmr_documents')
    .select('status')
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  const wasDraft = (existing as { status?: string } | null)?.status === 'draft'

  const { error: updateError } = await service
    .from('cmr_documents')
    .update({
      pdf_storage_path: built.path,
      pdf_generated_at: new Date().toISOString(),
      ...(wasDraft ? { status: 'issued' } : {}),
    })
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
  if (updateError) {
    return { data: null, error: 'Échec de l\'enregistrement du PDF.' }
  }

  if (wasDraft) {
    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'cmr_document',
      entityId: cmrId,
      action: 'send',
      notes: `CMR ${built.cmrNumber} émise — passage de draft à issued`,
      afterState: { cmr_number: built.cmrNumber, status: 'issued' },
      actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
    })
  }

  revalidatePath('/[locale]/(dashboard)/cmr', 'page')
  revalidatePath(`/[locale]/(dashboard)/cmr/${cmrId}`, 'page')
  return { data: { cmrId, pdfPath: built.path }, error: null }
}

export async function getCmrSignedUrl(
  cmrId: string,
): Promise<ActionResult<{ url: string; cmrNumber: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!z.string().uuid().safeParse(cmrId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('cmr_documents')
    .select('cmr_number, pdf_storage_path')
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  type Lite = { cmr_number: string; pdf_storage_path: string | null }
  const r = row as unknown as Lite | null
  if (!r) return { data: null, error: 'CMR introuvable.' }
  if (!r.pdf_storage_path) return { data: null, error: 'Aucun PDF généré pour cette CMR.' }

  const service = await createServiceClient()
  const { data: signed, error } = await service.storage
    .from('cmr-documents')
    .createSignedUrl(r.pdf_storage_path, 60 * 15)
  if (error || !signed) return { data: null, error: 'Lien indisponible.' }

  return { data: { url: signed.signedUrl, cmrNumber: r.cmr_number }, error: null }
}

export async function cancelCmr(
  cmrId: string,
  reason: string,
): Promise<ActionResult<{ cmrId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }
  if (!z.string().uuid().safeParse(cmrId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const trimmed = reason.trim()
  if (!trimmed) return { data: null, error: 'Motif d\'annulation requis.' }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('cmr_documents')
    .select('id, status, cmr_number, shipment_id')
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  type Lite = { id: string; status: string; cmr_number: string; shipment_id: string }
  const before = existing as unknown as Lite | null
  if (!before) return { data: null, error: 'CMR introuvable.' }
  if (before.status === 'cancelled') return { data: null, error: 'CMR déjà annulée.' }

  const { error } = await supabase
    .from('cmr_documents')
    .update({ status: 'cancelled', internal_notes: `Annulée : ${trimmed}` })
    .eq('id', cmrId)
    .eq('company_id', auth.companyId)
  if (error) return { data: null, error: 'Échec de l\'annulation.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'cmr_document',
    entityId: cmrId,
    action: 'archive',
    notes: trimmed,
    beforeState: { cmr_number: before.cmr_number, status: before.status },
    afterState: { cmr_number: before.cmr_number, status: 'cancelled' },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/cmr', 'page')
  return { data: { cmrId }, error: null }
}
