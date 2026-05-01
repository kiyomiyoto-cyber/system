'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher'] as const
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

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
// Free zone CRUD
// ============================================================
const zoneSchema = z.object({
  code: z.string().trim().min(1, 'Code requis').max(20).toUpperCase(),
  name: z.string().trim().min(1, 'Nom requis').max(160),
  city: z.string().trim().min(1, 'Ville requise').max(80),
  country: z.string().trim().length(2).default('MA'),
  customsOfficeCode: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export type FreeZoneInput = z.input<typeof zoneSchema>

export async function createFreeZone(rawInput: FreeZoneInput): Promise<ActionResult<{ zoneId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  const parsed = zoneSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const zoneId = crypto.randomUUID()
  const { error } = await supabase.from('free_zones').insert({
    id: zoneId,
    company_id: auth.companyId,
    code: input.code,
    name: input.name,
    city: input.city,
    country: input.country,
    customs_office_code: input.customsOfficeCode ?? null,
    notes: input.notes ?? null,
    is_active: input.isActive ?? true,
  })

  if (error) {
    if (error.code === '23505') return { data: null, error: 'Ce code de zone est déjà utilisé.' }
    logger.error('free_zone.create_failed', { companyId: auth.companyId, error: error.message })
    return { data: null, error: 'Échec de la création.' }
  }

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  return { data: { zoneId }, error: null }
}

export async function updateFreeZone(
  zoneId: string,
  rawInput: FreeZoneInput,
): Promise<ActionResult<{ zoneId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(zoneId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = zoneSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('free_zones')
    .update({
      code: input.code,
      name: input.name,
      city: input.city,
      country: input.country,
      customs_office_code: input.customsOfficeCode ?? null,
      notes: input.notes ?? null,
      is_active: input.isActive ?? true,
    })
    .eq('id', zoneId)
    .eq('company_id', auth.companyId)

  if (error) {
    if (error.code === '23505') return { data: null, error: 'Ce code de zone est déjà utilisé.' }
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  return { data: { zoneId }, error: null }
}

// ============================================================
// Required documents matrix
// ============================================================
const matrixSchema = z.object({
  freeZoneId: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  isRequired: z.boolean(),
})

export type MatrixToggleInput = z.input<typeof matrixSchema>

export async function setRequiredDocument(
  rawInput: MatrixToggleInput,
): Promise<ActionResult<{ freeZoneId: string; documentTypeId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  const parsed = matrixSchema.safeParse(rawInput)
  if (!parsed.success) return { data: null, error: 'Données invalides.' }
  const input = parsed.data

  const supabase = await createClient()

  if (input.isRequired) {
    const { error } = await supabase
      .from('free_zone_required_documents')
      .upsert(
        {
          free_zone_id: input.freeZoneId,
          document_type_id: input.documentTypeId,
          company_id: auth.companyId,
          is_required: true,
        },
        { onConflict: 'free_zone_id,document_type_id' },
      )
    if (error) return { data: null, error: 'Échec de la mise à jour.' }
  } else {
    const { error } = await supabase
      .from('free_zone_required_documents')
      .delete()
      .eq('free_zone_id', input.freeZoneId)
      .eq('document_type_id', input.documentTypeId)
      .eq('company_id', auth.companyId)
    if (error) return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  return {
    data: { freeZoneId: input.freeZoneId, documentTypeId: input.documentTypeId },
    error: null,
  }
}

// ============================================================
// Shipment ↔ free zone link
// ============================================================
const linkSchema = z.object({
  shipmentId: z.string().uuid(),
  pickupFreeZoneId: z.string().uuid().nullable(),
  deliveryFreeZoneId: z.string().uuid().nullable(),
})

export type ShipmentZoneLinkInput = z.input<typeof linkSchema>

export async function setShipmentFreeZones(
  rawInput: ShipmentZoneLinkInput,
): Promise<ActionResult<{ shipmentId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  const parsed = linkSchema.safeParse(rawInput)
  if (!parsed.success) return { data: null, error: 'Données invalides.' }
  const input = parsed.data

  const supabase = await createClient()

  // Verify shipment + zones belong to tenant
  const { data: ship } = await supabase
    .from('shipments')
    .select('id')
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!ship) return { data: null, error: 'Mission introuvable.' }

  for (const zoneId of [input.pickupFreeZoneId, input.deliveryFreeZoneId]) {
    if (zoneId == null) continue
    const { data: zone } = await supabase
      .from('free_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!zone) return { data: null, error: 'Zone introuvable.' }
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      pickup_free_zone_id: input.pickupFreeZoneId,
      delivery_free_zone_id: input.deliveryFreeZoneId,
    })
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la mise à jour.' }

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${input.shipmentId}`, 'page')
  return { data: { shipmentId: input.shipmentId }, error: null }
}

// ============================================================
// Customs document upload
// ============================================================
const uploadMetaSchema = z.object({
  shipmentId: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  documentNumber: z.string().trim().max(80).nullable().optional(),
  documentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export type UploadCustomsDocumentInput = z.input<typeof uploadMetaSchema> & { formData: FormData }

export async function uploadCustomsDocument(
  rawInput: UploadCustomsDocumentInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  const parsed = uploadMetaSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const file = rawInput.formData.get('file')
  if (!(file instanceof File)) return { data: null, error: 'Fichier manquant.' }
  if (file.size === 0) return { data: null, error: 'Fichier vide.' }
  if (file.size > MAX_BYTES) return { data: null, error: 'Fichier trop volumineux (max 10 Mo).' }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { data: null, error: 'Type de fichier non autorisé (PDF / JPG / PNG / WEBP).' }
  }

  const supabase = await createClient()

  // Verify shipment + doc type belong to tenant
  const [{ data: ship }, { data: docType }] = await Promise.all([
    supabase
      .from('shipments')
      .select('id')
      .eq('id', input.shipmentId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('customs_document_types')
      .select('id, code')
      .eq('id', input.documentTypeId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (!ship) return { data: null, error: 'Mission introuvable.' }
  if (!docType) return { data: null, error: 'Type de document introuvable.' }

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] ?? 'bin'
  const stamp = Date.now()
  const code = (docType as { code: string }).code
  const path = `${auth.companyId}/${input.shipmentId}/${code}_${stamp}.${ext}`

  const service = await createServiceClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await service.storage
    .from('customs-documents')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    logger.error('customs.upload_failed', {
      shipmentId: input.shipmentId,
      error: uploadError.message,
    })
    return { data: null, error: 'Échec du téléversement.' }
  }

  const id = crypto.randomUUID()
  const { error: insertError } = await supabase.from('shipment_customs_documents').insert({
    id,
    company_id: auth.companyId,
    shipment_id: input.shipmentId,
    document_type_id: input.documentTypeId,
    document_number: input.documentNumber ?? null,
    document_date: input.documentDate ?? null,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    notes: input.notes ?? null,
    uploaded_by_user_id: auth.user.id,
  })

  if (insertError) {
    // Rollback Storage upload to avoid orphans
    await service.storage.from('customs-documents').remove([path])
    return { data: null, error: 'Échec de l\'enregistrement du document.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'shipment_customs_document',
    entityId: id,
    action: 'create',
    afterState: {
      shipment_id: input.shipmentId,
      document_type_id: input.documentTypeId,
      document_type_code: (docType as { code: string }).code,
      document_number: input.documentNumber ?? null,
      document_date: input.documentDate ?? null,
      file_name: file.name,
      file_size_bytes: file.size,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${input.shipmentId}`, 'page')
  return { data: { id }, error: null }
}

export async function deleteCustomsDocument(
  documentId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!isWriter(auth.user.role)) return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(documentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('shipment_customs_documents')
    .select('id, storage_path, shipment_id, document_type_id, file_name, document_number')
    .eq('id', documentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { data: null, error: 'Document introuvable.' }
  type ExistingDoc = {
    id: string
    storage_path: string
    shipment_id: string
    document_type_id: string
    file_name: string
    document_number: string | null
  }
  const before = doc as unknown as ExistingDoc

  const { error } = await supabase
    .from('shipment_customs_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('company_id', auth.companyId)
  if (error) return { data: null, error: 'Échec de la suppression.' }

  // Best-effort Storage cleanup (RLS allows it, ignore failure)
  const service = await createServiceClient()
  await service.storage.from('customs-documents').remove([before.storage_path])

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'shipment_customs_document',
    entityId: documentId,
    action: 'delete',
    beforeState: {
      shipment_id: before.shipment_id,
      document_type_id: before.document_type_id,
      file_name: before.file_name,
      document_number: before.document_number,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/zones-franches', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${before.shipment_id}`, 'page')
  return { data: { id: documentId }, error: null }
}

export async function getCustomsDocumentSignedUrl(
  documentId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(documentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('shipment_customs_documents')
    .select('storage_path, file_name')
    .eq('id', documentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { data: null, error: 'Document introuvable.' }

  const service = await createServiceClient()
  const { data: signed, error } = await service.storage
    .from('customs-documents')
    .createSignedUrl((doc as { storage_path: string }).storage_path, 60 * 15) // 15 min
  if (error || !signed) return { data: null, error: 'Lien indisponible.' }

  return {
    data: { url: signed.signedUrl, fileName: (doc as { file_name: string }).file_name },
    error: null,
  }
}
