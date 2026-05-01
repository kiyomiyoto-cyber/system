'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { dispatchNotification } from '@/lib/notifications'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import {
  MissionOrderPDF,
  type MissionOrderData,
} from '@/lib/pdf/mission-order-generator'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher'] as const
const VEHICLE_TYPES = ['motorcycle', 'van', 'truck', 'pickup'] as const

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

function ensureWriter(auth: AuthOk): { ok: true } | { ok: false; error: string } {
  if (!WRITE_ROLES.includes(auth.user.role as (typeof WRITE_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true }
}

// ============================================================
// Subcontractor CRUD
// ============================================================

const subcontractorSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(160),
  legalForm: z.string().trim().max(40).nullable().optional(),
  ice: z
    .string()
    .trim()
    .regex(/^\d{15}$/u, 'ICE invalide (15 chiffres attendus)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  rcNumber: z.string().trim().max(40).nullable().optional(),
  taxId: z.string().trim().max(40).nullable().optional(),
  cnssNumber: z.string().trim().max(40).nullable().optional(),

  contactName: z.string().trim().max(120).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  contactEmail: z.string().trim().email('Email invalide').nullable().optional()
    .or(z.literal('').transform(() => null)),
  whatsappPhone: z.string().trim().max(40).nullable().optional(),

  address: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),

  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).default([]),
  serviceAreas: z.array(z.string().trim().min(1).max(80)).default([]),
  capacityKg: z.coerce.number().int().positive().max(100_000).nullable().optional(),

  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),

  bankName: z.string().trim().max(120).nullable().optional(),
  bankIban: z.string().trim().max(40).nullable().optional(),
  bankSwift: z.string().trim().max(20).nullable().optional(),

  paymentTermsDays: z.coerce.number().int().min(0).max(180).default(30),

  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export type SubcontractorInput = z.input<typeof subcontractorSchema>

export async function createSubcontractor(
  rawInput: SubcontractorInput,
): Promise<ActionResult<{ subcontractorId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  const parsed = subcontractorSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const subcontractorId = crypto.randomUUID()

  const { error } = await supabase.from('subcontractors').insert({
    id: subcontractorId,
    company_id: auth.companyId,
    name: input.name,
    legal_form: input.legalForm ?? null,
    ice: input.ice ?? null,
    rc_number: input.rcNumber ?? null,
    tax_id: input.taxId ?? null,
    cnss_number: input.cnssNumber ?? null,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null,
    whatsapp_phone: input.whatsappPhone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    postal_code: input.postalCode ?? null,
    vehicle_types: input.vehicleTypes,
    service_areas: input.serviceAreas,
    capacity_kg: input.capacityKg ?? null,
    rating: input.rating ?? null,
    bank_name: input.bankName ?? null,
    bank_iban: input.bankIban ?? null,
    bank_swift: input.bankSwift ?? null,
    payment_terms_days: input.paymentTermsDays,
    notes: input.notes ?? null,
    is_active: input.isActive ?? true,
    created_by_user_id: auth.user.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Un sous-traitant porte déjà ce nom.' }
    }
    logger.error('subcontractor.create_failed', {
      action: 'createSubcontractor',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la création du sous-traitant.' }
  }

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { subcontractorId }, error: null }
}

export async function updateSubcontractor(
  subcontractorId: string,
  rawInput: SubcontractorInput,
): Promise<ActionResult<{ subcontractorId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  if (!z.string().uuid().safeParse(subcontractorId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = subcontractorSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('subcontractors')
    .select('id')
    .eq('id', subcontractorId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Sous-traitant introuvable.' }

  const { error } = await supabase
    .from('subcontractors')
    .update({
      name: input.name,
      legal_form: input.legalForm ?? null,
      ice: input.ice ?? null,
      rc_number: input.rcNumber ?? null,
      tax_id: input.taxId ?? null,
      cnss_number: input.cnssNumber ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      contact_email: input.contactEmail ?? null,
      whatsapp_phone: input.whatsappPhone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      postal_code: input.postalCode ?? null,
      vehicle_types: input.vehicleTypes,
      service_areas: input.serviceAreas,
      capacity_kg: input.capacityKg ?? null,
      rating: input.rating ?? null,
      bank_name: input.bankName ?? null,
      bank_iban: input.bankIban ?? null,
      bank_swift: input.bankSwift ?? null,
      payment_terms_days: input.paymentTermsDays,
      notes: input.notes ?? null,
      is_active: input.isActive ?? true,
    })
    .eq('id', subcontractorId)
    .eq('company_id', auth.companyId)

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Un sous-traitant porte déjà ce nom.' }
    }
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { subcontractorId }, error: null }
}

export async function deleteSubcontractor(
  subcontractorId: string,
): Promise<ActionResult<{ subcontractorId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'company_admin') {
    return { data: null, error: 'Non autorisé.' }
  }
  if (!z.string().uuid().safeParse(subcontractorId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()

  // Block soft-delete if there are non-final missions referencing this partner.
  const { count: openCount } = await supabase
    .from('subcontracted_missions')
    .select('id', { count: 'exact', head: true })
    .eq('subcontractor_id', subcontractorId)
    .eq('company_id', auth.companyId)
    .not('status', 'in', '(completed,cancelled)')
    .is('deleted_at', null)
  if (openCount && openCount > 0) {
    return { data: null, error: 'Sous-traitant utilisé dans des missions en cours.' }
  }

  const { error } = await supabase
    .from('subcontractors')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', subcontractorId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { subcontractorId }, error: null }
}

// ============================================================
// Subcontracted mission CRUD
// ============================================================

const missionSchema = z.object({
  shipmentId: z.string().uuid('Expédition invalide'),
  subcontractorId: z.string().uuid('Sous-traitant invalide'),
  costExclTax: z.coerce.number().nonnegative().max(10_000_000),
  notes: z.string().trim().max(1000).nullable().optional(),
  internalNotes: z.string().trim().max(1000).nullable().optional(),
})

export type MissionInput = z.input<typeof missionSchema>

export async function createSubcontractedMission(
  rawInput: MissionInput,
): Promise<ActionResult<{ missionId: string; missionOrderNumber: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  const parsed = missionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  // Verify shipment belongs to tenant + not yet subcontracted
  const { data: shipment } = await supabase
    .from('shipments')
    .select('id, price_excl_tax, subcontracted_mission_id')
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!shipment) return { data: null, error: 'Expédition introuvable.' }
  if (shipment.subcontracted_mission_id) {
    return { data: null, error: 'Cette expédition est déjà sous-traitée.' }
  }

  // Verify subcontractor belongs to tenant + active
  const { data: subcontractor } = await supabase
    .from('subcontractors')
    .select('id, is_active')
    .eq('id', input.subcontractorId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!subcontractor) return { data: null, error: 'Sous-traitant introuvable.' }
  if (!subcontractor.is_active) {
    return { data: null, error: 'Sous-traitant inactif.' }
  }

  // Sale snapshot — the client price at moment of subcontracting.
  // If the shipment has no price yet (pricing snapshot pending), use 0.
  // Margin will then be -cost; the dispatcher can edit the shipment price
  // first if they want a positive margin captured.
  const saleExclTax = Number(shipment.price_excl_tax ?? 0)

  // Allocate mission order sequence
  const { data: seqValue, error: seqError } = await supabase.rpc('next_sequence_value', {
    p_company_id: auth.companyId,
    p_type: 'mission_order',
  })
  if (seqError || typeof seqValue !== 'number') {
    logger.error('mission.seq_failed', { error: seqError?.message ?? 'sequence missing' })
    return { data: null, error: 'Échec de l\'attribution du numéro de mission.' }
  }

  // Build the mission order number: {SLUG}-OM-{YY}-{NNNNN}
  const { data: company } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', auth.companyId)
    .maybeSingle()
  if (!company?.slug) return { data: null, error: 'Entreprise introuvable.' }
  const yearShort = new Date().getFullYear().toString().slice(-2)
  const padded = String(seqValue).padStart(5, '0')
  const missionOrderNumber = `${String(company.slug).toUpperCase()}-OM-${yearShort}-${padded}`

  const missionId = crypto.randomUUID()
  const { error: insertError } = await supabase
    .from('subcontracted_missions')
    .insert({
      id: missionId,
      company_id: auth.companyId,
      subcontractor_id: input.subcontractorId,
      shipment_id: input.shipmentId,
      mission_order_number: missionOrderNumber,
      cost_excl_tax: input.costExclTax,
      sale_excl_tax: saleExclTax,
      currency: 'MAD',
      status: 'draft',
      notes: input.notes ?? null,
      internal_notes: input.internalNotes ?? null,
      created_by_user_id: auth.user.id,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { data: null, error: 'Cette expédition est déjà sous-traitée.' }
    }
    logger.error('mission.create_failed', {
      action: 'createSubcontractedMission',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: insertError.message,
    })
    return { data: null, error: 'Échec de la création de la mission.' }
  }

  // Back-link the shipment for fast lookup (RLS guarantees same tenant)
  await supabase
    .from('shipments')
    .update({ subcontracted_mission_id: missionId })
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'subcontracted_mission',
    entityId: missionId,
    action: 'create',
    afterState: {
      mission_order_number: missionOrderNumber,
      subcontractor_id: input.subcontractorId,
      shipment_id: input.shipmentId,
      cost_excl_tax: input.costExclTax,
      sale_excl_tax: saleExclTax,
      margin_excl_tax: saleExclTax - Number(input.costExclTax),
      status: 'draft',
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { missionId, missionOrderNumber }, error: null }
}

const missionUpdateSchema = z.object({
  costExclTax: z.coerce.number().nonnegative().max(10_000_000),
  notes: z.string().trim().max(1000).nullable().optional(),
  internalNotes: z.string().trim().max(1000).nullable().optional(),
})

export type MissionUpdateInput = z.input<typeof missionUpdateSchema>

export async function updateSubcontractedMission(
  missionId: string,
  rawInput: MissionUpdateInput,
): Promise<ActionResult<{ missionId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  if (!z.string().uuid().safeParse(missionId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = missionUpdateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('subcontracted_missions')
    .select('id, status, cost_excl_tax, sale_excl_tax, mission_order_number')
    .eq('id', missionId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Mission introuvable.' }
  type ExistingMission = {
    id: string
    status: string
    cost_excl_tax: number | string
    sale_excl_tax: number | string
    mission_order_number: string
  }
  const before = existing as unknown as ExistingMission
  if (before.status === 'completed' || before.status === 'cancelled') {
    return { data: null, error: 'Mission verrouillée — édition impossible.' }
  }

  const { error } = await supabase
    .from('subcontracted_missions')
    .update({
      cost_excl_tax: input.costExclTax,
      notes: input.notes ?? null,
      internal_notes: input.internalNotes ?? null,
    })
    .eq('id', missionId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la mise à jour.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'subcontracted_mission',
    entityId: missionId,
    action: 'update',
    beforeState: {
      mission_order_number: before.mission_order_number,
      cost_excl_tax: Number(before.cost_excl_tax),
      sale_excl_tax: Number(before.sale_excl_tax),
    },
    afterState: {
      mission_order_number: before.mission_order_number,
      cost_excl_tax: input.costExclTax,
      sale_excl_tax: Number(before.sale_excl_tax),
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { missionId }, error: null }
}

const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export async function setMissionStatus(
  missionId: string,
  newStatus: 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled',
): Promise<ActionResult<{ missionId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  if (!z.string().uuid().safeParse(missionId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('subcontracted_missions')
    .select('id, status, mission_order_number')
    .eq('id', missionId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Mission introuvable.' }
  type ExistingStatusRow = { id: string; status: string; mission_order_number: string }
  const beforeRow = existing as unknown as ExistingStatusRow

  const allowed = STATUS_TRANSITIONS[beforeRow.status] ?? []
  if (!allowed.includes(newStatus)) {
    return { data: null, error: `Transition non autorisée (${beforeRow.status} → ${newStatus}).` }
  }

  const patch: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'accepted') patch.accepted_at = new Date().toISOString()
  if (newStatus === 'completed') patch.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('subcontracted_missions')
    .update(patch)
    .eq('id', missionId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la mise à jour du statut.' }

  // Mission completion has direct financial impact (margin closes) → always log.
  // Cancellation matters too (penalty exposure changes). Other transitions are
  // operational but tracked anyway so the comptable has a full timeline.
  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'subcontracted_mission',
    entityId: missionId,
    action:
      newStatus === 'completed'
        ? 'complete'
        : newStatus === 'cancelled'
          ? 'archive'
          : 'update',
    beforeState: { mission_order_number: beforeRow.mission_order_number, status: beforeRow.status },
    afterState: { mission_order_number: beforeRow.mission_order_number, status: newStatus },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { missionId }, error: null }
}

// ============================================================
// Mission order PDF generation + send
// ============================================================

interface MissionFullRow {
  id: string
  mission_order_number: string
  cost_excl_tax: string | number
  notes: string | null
  status: string
  mission_order_pdf_path: string | null
  subcontractor: {
    name: string
    contact_name: string | null
    contact_phone: string | null
    contact_email: string | null
    whatsapp_phone: string | null
    ice: string | null
    address: string | null
    city: string | null
    payment_terms_days: number
  } | null
  shipment: {
    reference: string
    pickup_street: string
    pickup_city: string
    pickup_contact_name: string | null
    pickup_contact_phone: string | null
    pickup_scheduled_at: string | null
    delivery_street: string
    delivery_city: string
    delivery_contact_name: string | null
    delivery_contact_phone: string | null
    delivery_scheduled_at: string | null
    weight_kg: number | string | null
    description: string | null
    is_urgent: boolean
    distance_km: number | string | null
  } | null
}

async function buildMissionPdf(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  companyId: string,
  missionId: string,
): Promise<{ buffer: Buffer; missionOrderNumber: string; path: string } | { error: string }> {
  const { data: companyRow } = await service
    .from('companies')
    .select('name, address, city, phone, email, tax_id')
    .eq('id', companyId)
    .maybeSingle()
  if (!companyRow) return { error: 'Entreprise introuvable.' }

  const { data: mission } = await service
    .from('subcontracted_missions')
    .select(
      'id, mission_order_number, cost_excl_tax, notes, status, mission_order_pdf_path, subcontractor:subcontractors(name, contact_name, contact_phone, contact_email, whatsapp_phone, ice, address, city, payment_terms_days), shipment:shipments(reference, pickup_street, pickup_city, pickup_contact_name, pickup_contact_phone, pickup_scheduled_at, delivery_street, delivery_city, delivery_contact_name, delivery_contact_phone, delivery_scheduled_at, weight_kg, description, is_urgent, distance_km)',
    )
    .eq('id', missionId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  const row = mission as unknown as MissionFullRow | null
  if (!row || !row.subcontractor || !row.shipment) {
    return { error: 'Mission introuvable.' }
  }

  const pdfData: MissionOrderData = {
    missionOrderNumber: row.mission_order_number,
    issueDate: new Date().toISOString(),
    company: {
      name: companyRow.name,
      address: companyRow.address,
      city: companyRow.city,
      phone: companyRow.phone,
      email: companyRow.email,
      ice: companyRow.tax_id,
    },
    subcontractor: {
      name: row.subcontractor.name,
      contactName: row.subcontractor.contact_name,
      contactPhone: row.subcontractor.contact_phone,
      contactEmail: row.subcontractor.contact_email,
      ice: row.subcontractor.ice,
      address: row.subcontractor.address,
      city: row.subcontractor.city,
    },
    shipment: {
      reference: row.shipment.reference,
      pickupStreet: row.shipment.pickup_street,
      pickupCity: row.shipment.pickup_city,
      pickupContactName: row.shipment.pickup_contact_name,
      pickupContactPhone: row.shipment.pickup_contact_phone,
      pickupScheduledAt: row.shipment.pickup_scheduled_at,
      deliveryStreet: row.shipment.delivery_street,
      deliveryCity: row.shipment.delivery_city,
      deliveryContactName: row.shipment.delivery_contact_name,
      deliveryContactPhone: row.shipment.delivery_contact_phone,
      deliveryScheduledAt: row.shipment.delivery_scheduled_at,
      weightKg: row.shipment.weight_kg == null ? null : Number(row.shipment.weight_kg),
      description: row.shipment.description,
      isUrgent: row.shipment.is_urgent,
      distanceKm: row.shipment.distance_km == null ? null : Number(row.shipment.distance_km),
    },
    pricing: {
      costExclTax: Number(row.cost_excl_tax),
      currency: 'MAD',
      paymentTermsDays: row.subcontractor.payment_terms_days,
    },
    notes: row.notes,
  }

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(MissionOrderPDF({ data: pdfData }))
  } catch (err) {
    logger.error('mission.pdf_render_failed', {
      missionId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { error: 'Échec de la génération du PDF.' }
  }

  const path = `${companyId}/${missionId}/${row.mission_order_number}.pdf`
  return { buffer, missionOrderNumber: row.mission_order_number, path }
}

export async function generateMissionOrderPdf(
  missionId: string,
): Promise<ActionResult<{ missionId: string; pdfPath: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  if (!z.string().uuid().safeParse(missionId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const service = await createServiceClient()
  const built = await buildMissionPdf(service, auth.companyId, missionId)
  if ('error' in built) return { data: null, error: built.error }

  const { error: uploadError } = await service.storage
    .from('mission-orders')
    .upload(built.path, built.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadError) {
    logger.error('mission.pdf_upload_failed', {
      missionId,
      error: uploadError.message,
    })
    return { data: null, error: 'Échec du téléversement du PDF.' }
  }

  const { error: updateError } = await service
    .from('subcontracted_missions')
    .update({ mission_order_pdf_path: built.path })
    .eq('id', missionId)
    .eq('company_id', auth.companyId)
  if (updateError) {
    return { data: null, error: 'Échec de l\'enregistrement du PDF.' }
  }

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')
  return { data: { missionId, pdfPath: built.path }, error: null }
}

export async function getMissionOrderSignedUrl(
  missionId: string,
): Promise<ActionResult<{ url: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(missionId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: mission } = await supabase
    .from('subcontracted_missions')
    .select('mission_order_pdf_path')
    .eq('id', missionId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!mission?.mission_order_pdf_path) {
    return { data: null, error: 'Aucun PDF généré pour cette mission.' }
  }

  const service = await createServiceClient()
  const { data: signed, error } = await service.storage
    .from('mission-orders')
    .createSignedUrl(mission.mission_order_pdf_path, 60 * 15) // 15 min TTL
  if (error || !signed) {
    return { data: null, error: 'Impossible de générer le lien sécurisé.' }
  }
  return { data: { url: signed.signedUrl }, error: null }
}

const sendSchema = z.object({
  via: z.enum(['email', 'whatsapp']),
  to: z.string().trim().min(3).max(160),
})

export type SendMissionInput = z.input<typeof sendSchema>

export async function sendMissionOrder(
  missionId: string,
  rawInput: SendMissionInput,
): Promise<ActionResult<{ missionId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  const w = ensureWriter(auth)
  if (!w.ok) return { data: null, error: w.error }

  if (!z.string().uuid().safeParse(missionId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = sendSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  // Validate recipient by channel
  if (input.via === 'email' && !z.string().email().safeParse(input.to).success) {
    return { data: null, error: 'Email invalide.' }
  }

  const service = await createServiceClient()

  // Ensure PDF exists and is fresh — regenerate every send so an edited
  // cost or note is always reflected on the document the partner receives.
  const built = await buildMissionPdf(service, auth.companyId, missionId)
  if ('error' in built) return { data: null, error: built.error }

  const { error: uploadError } = await service.storage
    .from('mission-orders')
    .upload(built.path, built.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadError) {
    return { data: null, error: 'Échec du téléversement du PDF.' }
  }

  const { data: signed } = await service.storage
    .from('mission-orders')
    .createSignedUrl(built.path, 60 * 60 * 24 * 7) // 7-day TTL on the link

  const url = signed?.signedUrl ?? null

  const { data: companyRow } = await service
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .maybeSingle()
  const companyName = companyRow?.name ?? 'MASLAK'

  const subject = `${companyName} — Ordre de mission ${built.missionOrderNumber}`
  const body =
    input.via === 'email'
      ? `Bonjour,\n\nVeuillez trouver ci-joint l'ordre de mission ${built.missionOrderNumber}.\n\n${url ? `Téléchargement (lien valide 7 jours) :\n${url}\n\n` : ''}Cordialement,\n${companyName}`
      : `Ordre de mission ${built.missionOrderNumber}${url ? ` — ${url}` : ''}`

  const result = await dispatchNotification(
    auth.companyId,
    {
      to: input.to,
      subject,
      body,
      channel: input.via,
      audience: 'admin',
      metadata: { missionId, missionOrderNumber: built.missionOrderNumber },
    },
    { userId: auth.user.id, relatedId: missionId, relatedType: 'subcontracted_mission' },
  )

  // Persist mission order metadata regardless of provider success — the
  // operator may resend manually. The notifications table holds the failure
  // detail.
  const sentPatch: Record<string, unknown> = {
    mission_order_pdf_path: built.path,
    sent_at: new Date().toISOString(),
    sent_via: input.via,
    sent_to: input.to,
  }
  // Auto-advance draft → sent on first successful send.
  const { data: existing } = await service
    .from('subcontracted_missions')
    .select('status')
    .eq('id', missionId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (existing?.status === 'draft' && result.success) {
    sentPatch.status = 'sent'
  }

  await service
    .from('subcontracted_missions')
    .update(sentPatch)
    .eq('id', missionId)
    .eq('company_id', auth.companyId)

  if (result.success) {
    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'subcontracted_mission',
      entityId: missionId,
      action: 'send',
      afterState: {
        mission_order_number: built.missionOrderNumber,
        sent_via: input.via,
        sent_to: input.to,
      },
      notes: `Ordre de mission ${built.missionOrderNumber} envoyé via ${input.via}`,
      actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
    })
  }

  revalidatePath('/[locale]/(dashboard)/sous-traitance', 'page')

  if (!result.success) {
    return { data: null, error: result.error ?? 'Échec de l\'envoi.' }
  }
  return { data: { missionId }, error: null }
}
