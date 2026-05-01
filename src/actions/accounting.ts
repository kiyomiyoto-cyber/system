'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { dispatchNotification } from '@/lib/notifications'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type {
  AccountingDocumentCategory,
  AccountingFileType,
  AccountingPaymentMethod,
} from '@/types/database.types'

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_PDF_MIME = ['application/pdf'] as const
const ALLOWED_MIME = [...ALLOWED_IMAGE_MIME, ...ALLOWED_PDF_MIME] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB (matches CLAUDE.md upload limit)

const CAPTURE_CATEGORIES = [
  'invoice_supplier',
  'fuel_receipt',
  'toll_receipt',
  'maintenance_receipt',
  'driver_advance',
  'phone_internet',
  'office_rent',
  'insurance',
  'other',
] as const satisfies readonly AccountingDocumentCategory[]

const captureSchema = z.object({
  documentCategory: z.enum(CAPTURE_CATEGORIES),
  amountTtc: z.coerce.number().positive('Le montant doit être positif').max(1_000_000),
  vehicleId: z.string().uuid().nullable().optional(),
  subcategory: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export type CaptureAccountingInput = z.input<typeof captureSchema>

function pickFileType(mime: string): AccountingFileType {
  if (mime === 'application/pdf') return 'pdf'
  return 'image'
}

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg'
    case 'image/png':  return 'png'
    case 'image/webp': return 'webp'
    case 'application/pdf': return 'pdf'
    default: return 'bin'
  }
}

function buildStoragePath(companyId: string, documentId: string, mime: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${companyId}/${yyyy}/${mm}/${documentId}.${extensionFor(mime)}`
}

export async function captureAccountingDocument(
  rawInput: CaptureAccountingInput,
  file: File,
): Promise<ActionResult<{ documentId: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) {
    return { data: null, error: 'Non autorisé.' }
  }
  const companyId: string = user.companyId
  if (!['company_admin', 'comptable', 'dispatcher', 'driver'].includes(user.role)) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = captureSchema.safeParse(rawInput)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { data: null, error: first?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { data: null, error: 'Format non supporté. Utilisez JPEG, PNG, WebP ou PDF.' }
  }
  if (file.size === 0) {
    return { data: null, error: 'Fichier vide.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { data: null, error: 'Fichier trop volumineux (max 10 Mo).' }
  }

  // Drivers can only attach documents to themselves; they cannot tag a vehicle
  // they aren't currently driving. We resolve the linked driver server-side.
  let linkedDriverId: string | null = null
  let linkedVehicleId: string | null = input.vehicleId ?? null

  const supabase = await createClient()

  if (user.role === 'driver') {
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single()
    if (!driverRow) {
      return { data: null, error: 'Profil chauffeur introuvable.' }
    }
    linkedDriverId = driverRow.id
    // Drivers don't pick a vehicle in the form; if their current assignment
    // exists we attach it for traceability (fuel ticket → assigned vehicle).
    const { data: assignment } = await supabase
      .from('driver_vehicle_assignments')
      .select('vehicle_id')
      .eq('driver_id', driverRow.id)
      .eq('company_id', companyId)
      .is('unassigned_at', null)
      .limit(1)
      .maybeSingle()
    linkedVehicleId = assignment?.vehicle_id ?? null
  }

  // Validate vehicle belongs to current tenant (defense-in-depth — RLS + DB
  // trigger also enforce this, but we want a clean error message).
  if (linkedVehicleId) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', linkedVehicleId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!vehicle) {
      return { data: null, error: 'Véhicule introuvable.' }
    }
  }

  const documentId = crypto.randomUUID()
  const fileType = pickFileType(file.type)
  const storagePath = buildStoragePath(companyId, documentId, file.type)

  const service = await createServiceClient()

  const { error: uploadError } = await service.storage
    .from('accounting-documents')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    logger.error('accounting.capture.upload_failed', {
      action: 'captureAccountingDocument',
      userId: user.id,
      companyId: companyId,
      error: uploadError.message,
    })
    return { data: null, error: 'Échec du téléversement du fichier.' }
  }

  const { error: insertError } = await supabase
    .from('accounting_documents')
    .insert({
      id: documentId,
      company_id: companyId,
      document_category: input.documentCategory,
      subcategory: input.subcategory ?? null,
      amount_ttc: input.amountTtc,
      file_path: storagePath,
      file_type: fileType,
      file_mime: file.type,
      file_size_bytes: file.size,
      linked_vehicle_id: linkedVehicleId,
      linked_driver_id: linkedDriverId,
      captured_by_user_id: user.id,
      status: 'pending_review',
      notes: input.notes ?? null,
    })

  if (insertError) {
    // Best-effort cleanup of the orphaned storage object.
    await service.storage.from('accounting-documents').remove([storagePath])
    logger.error('accounting.capture.insert_failed', {
      action: 'captureAccountingDocument',
      userId: user.id,
      companyId: companyId,
      error: insertError.message,
    })
    return { data: null, error: 'Échec de l\'enregistrement du justificatif.' }
  }

  logger.info('accounting.capture.created', {
    action: 'captureAccountingDocument',
    userId: user.id,
    companyId: companyId,
    documentId,
    category: input.documentCategory,
  })

  await recordAccountingAudit({
    companyId,
    entityType: 'accounting_document',
    entityId: documentId,
    action: 'create',
    afterState: {
      document_category: input.documentCategory,
      amount_ttc: input.amountTtc,
      file_path: storagePath,
      status: 'pending_review',
      linked_vehicle_id: linkedVehicleId,
      linked_driver_id: linkedDriverId,
    },
    actor: { userId: user.id, role: user.role, name: user.fullName },
  })

  // Notify the company admin(s). Best-effort: a failed notification must not
  // break a successful capture.
  notifyAdminOfNewCapture({
    companyId: companyId,
    documentId,
    capturedByName: user.fullName,
    capturedByRole: user.role,
    category: input.documentCategory,
    amountTtc: input.amountTtc,
  }).catch((err) => {
    logger.warn('accounting.capture.notify_failed', {
      action: 'captureAccountingDocument',
      companyId: companyId,
      documentId,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  return { data: { documentId }, error: null }
}

interface NotifyParams {
  companyId: string
  documentId: string
  capturedByName: string
  capturedByRole: string
  category: AccountingDocumentCategory
  amountTtc: number
}

async function notifyAdminOfNewCapture(params: NotifyParams): Promise<void> {
  const service = await createServiceClient()

  // Find company_admin recipients in the same tenant.
  const { data: admins } = await service
    .from('users')
    .select('id, email, preferred_language')
    .eq('company_id', params.companyId)
    .eq('role', 'company_admin')
    .eq('is_active', true)
    .is('deleted_at', null)

  if (!admins || admins.length === 0) return

  const formatter = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  })
  const amountFormatted = formatter.format(params.amountTtc)
  const categoryLabelFr = CATEGORY_LABEL_FR[params.category]

  const subject = `Nouveau justificatif scanné — ${categoryLabelFr}`
  const body = [
    `Un nouveau justificatif a été scanné par ${params.capturedByName} (${params.capturedByRole}).`,
    ``,
    `Catégorie : ${categoryLabelFr}`,
    `Montant TTC : ${amountFormatted}`,
    ``,
    `Connectez-vous au tableau de bord pour valider ce justificatif.`,
  ].join('\n')

  await Promise.all(
    admins.map((admin) =>
      dispatchNotification(
        params.companyId,
        {
          to: admin.email,
          subject,
          body,
          channel: 'email',
          audience: 'admin',
          metadata: {
            kind: 'accounting_capture',
            documentId: params.documentId,
            category: params.category,
          },
        },
        {
          userId: admin.id,
          relatedId: params.documentId,
          relatedType: 'accounting_document',
        },
      ),
    ),
  )
}

// ============================================================
// Validation workflow (COMPTA-2)
// ============================================================

const ALLOWED_BACK_OFFICE_ROLES = ['super_admin', 'company_admin', 'comptable'] as const

type AccountingDocSnapshot = {
  status: string
  amount_ttc: number
  amount_ht: number | null
  vat_amount: number | null
  vat_rate: number
  document_category: AccountingDocumentCategory
  supplier_name: string | null
  supplier_ice: string | null
  document_date: string | null
  payment_date: string | null
  payment_method: AccountingPaymentMethod | null
  notes: string | null
  rejection_reason: string | null
  validated_at: string | null
  validated_by_user_id: string | null
}

async function loadDocumentSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  companyId: string,
): Promise<AccountingDocSnapshot | null> {
  const { data } = await supabase
    .from('accounting_documents')
    .select('status, amount_ttc, amount_ht, vat_amount, vat_rate, document_category, supplier_name, supplier_ice, document_date, payment_date, payment_method, notes, rejection_reason, validated_at, validated_by_user_id')
    .eq('id', documentId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()
  return data as AccountingDocSnapshot | null
}

async function ensureBackOffice(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>; companyId: string }
  | { ok: false; error: string }
> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!ALLOWED_BACK_OFFICE_ROLES.includes(user.role as (typeof ALLOWED_BACK_OFFICE_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

export async function validateAccountingDocument(
  documentId: string,
): Promise<ActionResult<{ documentId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(documentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const before = await loadDocumentSnapshot(supabase, documentId, auth.companyId)
  if (!before) return { data: null, error: 'Justificatif introuvable.' }
  if (before.status === 'validated' || before.status === 'sent_to_accountant') {
    return { data: null, error: 'Justificatif déjà validé.' }
  }

  const validatedAt = new Date().toISOString()
  const { error } = await supabase
    .from('accounting_documents')
    .update({
      status: 'validated',
      validated_at: validatedAt,
      validated_by_user_id: auth.user.id,
      rejection_reason: null,
    })
    .eq('id', documentId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('accounting.validate.failed', {
      action: 'validateAccountingDocument',
      userId: auth.user.id,
      companyId: auth.companyId,
      documentId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la validation.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'accounting_document',
    entityId: documentId,
    action: 'validate',
    beforeState: before,
    afterState: {
      ...before,
      status: 'validated',
      validated_at: validatedAt,
      validated_by_user_id: auth.user.id,
      rejection_reason: null,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  return { data: { documentId }, error: null }
}

const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Motif requis (min. 3 caractères)').max(500),
})

export async function rejectAccountingDocument(
  documentId: string,
  rawReason: string,
): Promise<ActionResult<{ documentId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(documentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = rejectSchema.safeParse({ reason: rawReason })
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Motif invalide.' }
  }

  const supabase = await createClient()
  const before = await loadDocumentSnapshot(supabase, documentId, auth.companyId)
  if (!before) return { data: null, error: 'Justificatif introuvable.' }

  const { error } = await supabase
    .from('accounting_documents')
    .update({
      status: 'rejected',
      rejection_reason: parsed.data.reason,
      validated_by_user_id: auth.user.id,
      validated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('accounting.reject.failed', {
      action: 'rejectAccountingDocument',
      userId: auth.user.id,
      companyId: auth.companyId,
      documentId,
      error: error.message,
    })
    return { data: null, error: 'Échec du rejet.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'accounting_document',
    entityId: documentId,
    action: 'reject',
    beforeState: before,
    afterState: { ...before, status: 'rejected', rejection_reason: parsed.data.reason },
    notes: parsed.data.reason,
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  await notifyCapturerOfRejection({
    companyId: auth.companyId,
    documentId,
    reason: parsed.data.reason,
  }).catch((err) => {
    logger.warn('accounting.reject.notify_failed', {
      action: 'rejectAccountingDocument',
      companyId: auth.companyId,
      documentId,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  return { data: { documentId }, error: null }
}

const completeSchema = z.object({
  amountHt: z.coerce.number().nonnegative().nullable().optional(),
  vatAmount: z.coerce.number().nonnegative().nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  supplierName: z.string().trim().max(160).nullable().optional(),
  supplierIce: z.string().trim().max(40).nullable().optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)').nullable().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)').nullable().optional(),
  paymentMethod: z.enum(['cash', 'transfer', 'check', 'card']).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export type CompleteAccountingInput = z.input<typeof completeSchema>

export async function completeAccountingDocument(
  documentId: string,
  rawInput: CompleteAccountingInput,
): Promise<ActionResult<{ documentId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(documentId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = completeSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const before = await loadDocumentSnapshot(supabase, documentId, auth.companyId)
  if (!before) return { data: null, error: 'Justificatif introuvable.' }

  const update: Record<string, unknown> = {}
  if (input.amountHt !== undefined) update.amount_ht = input.amountHt
  if (input.vatAmount !== undefined) update.vat_amount = input.vatAmount
  if (input.vatRate !== undefined) update.vat_rate = input.vatRate
  if (input.supplierName !== undefined) update.supplier_name = input.supplierName
  if (input.supplierIce !== undefined) update.supplier_ice = input.supplierIce
  if (input.documentDate !== undefined) update.document_date = input.documentDate
  if (input.paymentDate !== undefined) update.payment_date = input.paymentDate
  if (input.paymentMethod !== undefined) update.payment_method = input.paymentMethod
  if (input.notes !== undefined) update.notes = input.notes

  if (Object.keys(update).length === 0) {
    return { data: null, error: 'Aucun champ à mettre à jour.' }
  }

  const { error } = await supabase
    .from('accounting_documents')
    .update(update)
    .eq('id', documentId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('accounting.complete.failed', {
      action: 'completeAccountingDocument',
      userId: auth.user.id,
      companyId: auth.companyId,
      documentId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'accounting_document',
    entityId: documentId,
    action: 'complete',
    beforeState: before,
    afterState: { ...before, ...update },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  return { data: { documentId }, error: null }
}

export async function getSignedAccountingUrl(
  filePath: string,
  ttlSeconds = 3600,
): Promise<ActionResult<{ url: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }

  // Path begins with company_id — verify before signing. super_admin
  // can sign for any tenant.
  const ownerSegment = filePath.split('/')[0]
  if (
    user.role !== 'super_admin'
    && (!ownerSegment || ownerSegment !== user.companyId)
  ) {
    return { data: null, error: 'Non autorisé.' }
  }

  const service = await createServiceClient()
  const { data, error } = await service.storage
    .from('accounting-documents')
    .createSignedUrl(filePath, ttlSeconds)

  if (error || !data) {
    return { data: null, error: error?.message ?? 'URL signée indisponible.' }
  }
  return { data: { url: data.signedUrl }, error: null }
}

interface NotifyRejectionParams {
  companyId: string
  documentId: string
  reason: string
}

async function notifyCapturerOfRejection(params: NotifyRejectionParams): Promise<void> {
  const service = await createServiceClient()
  const { data: doc } = await service
    .from('accounting_documents')
    .select('captured_by_user_id, document_category, amount_ttc')
    .eq('id', params.documentId)
    .eq('company_id', params.companyId)
    .maybeSingle()

  if (!doc?.captured_by_user_id) return

  const { data: capturer } = await service
    .from('users')
    .select('email, preferred_language')
    .eq('id', doc.captured_by_user_id)
    .maybeSingle()

  if (!capturer?.email) return

  const formatter = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })
  const subject = `Justificatif rejeté — ${CATEGORY_LABEL_FR[doc.document_category as AccountingDocumentCategory]}`
  const body = [
    `Votre justificatif (${CATEGORY_LABEL_FR[doc.document_category as AccountingDocumentCategory]}, ${formatter.format(doc.amount_ttc)}) a été rejeté.`,
    ``,
    `Motif : ${params.reason}`,
    ``,
    `Merci de scanner à nouveau le justificatif corrigé.`,
  ].join('\n')

  await dispatchNotification(
    params.companyId,
    {
      to: capturer.email,
      subject,
      body,
      channel: 'email',
      audience: 'driver',
      metadata: { kind: 'accounting_rejection', documentId: params.documentId },
    },
    {
      userId: doc.captured_by_user_id,
      relatedId: params.documentId,
      relatedType: 'accounting_document',
    },
  )
}

const CATEGORY_LABEL_FR: Record<AccountingDocumentCategory, string> = {
  invoice_client: 'Facture client',
  invoice_supplier: 'Facture fournisseur',
  fuel_receipt: 'Carburant',
  toll_receipt: 'Péage',
  maintenance_receipt: 'Maintenance',
  driver_advance: 'Avance chauffeur',
  salary_slip: 'Bulletin de paie',
  cnss_payment: 'Paiement CNSS',
  ir_payment: 'Paiement IR',
  phone_internet: 'Téléphone / Internet',
  office_rent: 'Loyer bureau',
  insurance: 'Assurance',
  bank_statement: 'Relevé bancaire',
  bank_fee: 'Frais bancaires',
  other: 'Autre',
}
