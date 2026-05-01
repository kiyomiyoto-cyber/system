'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type { TaxDeclarationType, AccountingDocumentCategory } from '@/types/database.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable'] as const

const VAT_DEDUCTIBLE_CATEGORIES: readonly AccountingDocumentCategory[] = [
  'fuel_receipt',
  'toll_receipt',
  'maintenance_receipt',
  'phone_internet',
  'office_rent',
  'insurance',
  'invoice_supplier',
  'bank_fee',
]

interface VatComputationInput {
  companyId: string
  periodMonth: string // YYYY-MM-01
}

export interface VatComputationResult {
  periodMonth: string
  vatCollected: number
  vatDeductible: number
  vatToPay: number
  collectedRows: Array<{ id: string; reference: string; client: string | null; total_excl_tax: number; total_tax: number; issued_at: string | null }>
  deductibleByCategory: Array<{ category: AccountingDocumentCategory; count: number; vatTotal: number; ttcTotal: number }>
  supportingDocumentIds: string[]
}

function nextMonthIso(periodMonth: string): string {
  const d = new Date(periodMonth)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export async function computeVatForPeriod(
  input: VatComputationInput,
): Promise<ActionResult<VatComputationResult>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { data: null, error: 'Non autorisé.' }
  }
  if (user.companyId !== input.companyId && user.role !== 'super_admin') {
    return { data: null, error: 'Non autorisé.' }
  }

  if (!/^\d{4}-\d{2}-01$/.test(input.periodMonth)) {
    return { data: null, error: 'Période invalide (attendu YYYY-MM-01).' }
  }

  const supabase = await createClient()
  const periodEnd = nextMonthIso(input.periodMonth)

  const [invoicesResult, docsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_excl_tax, total_tax, issued_at, status, client:clients(business_name)')
      .eq('company_id', input.companyId)
      .gte('issued_at', input.periodMonth)
      .lt('issued_at', periodEnd)
      .neq('status', 'cancelled')
      .is('deleted_at', null),
    supabase
      .from('accounting_documents')
      .select('id, document_category, amount_ttc, vat_amount, status')
      .eq('company_id', input.companyId)
      .gte('captured_at', input.periodMonth)
      .lt('captured_at', periodEnd)
      .in('status', ['validated', 'sent_to_accountant'])
      .is('deleted_at', null),
  ])

  type InvoiceRow = {
    id: string
    invoice_number: string
    total_excl_tax: number | null
    total_tax: number | null
    issued_at: string | null
    client: { business_name: string } | null
  }
  type DocRow = {
    id: string
    document_category: AccountingDocumentCategory
    amount_ttc: number
    vat_amount: number | null
  }

  const invoices = (invoicesResult.data ?? []) as unknown as InvoiceRow[]
  const docs = (docsResult.data ?? []) as unknown as DocRow[]

  const vatCollected = invoices.reduce((s, i) => s + Number(i.total_tax ?? 0), 0)

  const byCategory = new Map<AccountingDocumentCategory, { count: number; vatTotal: number; ttcTotal: number; ids: string[] }>()
  for (const doc of docs) {
    if (!VAT_DEDUCTIBLE_CATEGORIES.includes(doc.document_category)) continue
    if (doc.vat_amount == null) continue
    const cur = byCategory.get(doc.document_category) ?? { count: 0, vatTotal: 0, ttcTotal: 0, ids: [] }
    cur.count += 1
    cur.vatTotal += Number(doc.vat_amount)
    cur.ttcTotal += Number(doc.amount_ttc)
    cur.ids.push(doc.id)
    byCategory.set(doc.document_category, cur)
  }

  const vatDeductible = Array.from(byCategory.values()).reduce((s, c) => s + c.vatTotal, 0)
  const supportingDocumentIds = Array.from(byCategory.values()).flatMap((c) => c.ids)

  return {
    data: {
      periodMonth: input.periodMonth,
      vatCollected,
      vatDeductible,
      vatToPay: vatCollected - vatDeductible,
      collectedRows: invoices.map((i) => ({
        id: i.id,
        reference: i.invoice_number,
        client: i.client?.business_name ?? null,
        total_excl_tax: Number(i.total_excl_tax ?? 0),
        total_tax: Number(i.total_tax ?? 0),
        issued_at: i.issued_at,
      })),
      deductibleByCategory: Array.from(byCategory.entries()).map(([category, c]) => ({
        category,
        count: c.count,
        vatTotal: c.vatTotal,
        ttcTotal: c.ttcTotal,
      })),
      supportingDocumentIds,
    },
    error: null,
  }
}

const markDeclaredSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}-01$/, 'Période invalide'),
  declarationType: z.enum(['vat', 'ir', 'cnss']),
  declarationReference: z.string().trim().min(1, 'Référence requise').max(80),
  declarationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  amountDue: z.coerce.number().nonnegative(),
  amountPaid: z.coerce.number().nonnegative().nullable().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  computedSnapshot: z.record(z.unknown()).nullable().optional(),
  supportingDocumentIds: z.array(z.string().uuid()).optional(),
})

export type MarkDeclaredInput = z.input<typeof markDeclaredSchema>

export async function markTaxAsDeclared(
  rawInput: MarkDeclaredInput,
): Promise<ActionResult<{ declarationId: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = markDeclaredSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data
  const companyId = user.companyId

  const supabase = await createClient()
  const isPaid = input.amountPaid != null && input.amountPaid > 0
  const status = isPaid ? 'paid' : 'declared'

  const { data: existing } = await supabase
    .from('tax_declarations')
    .select('id')
    .eq('company_id', companyId)
    .eq('declaration_type', input.declarationType)
    .eq('period_month', input.periodMonth)
    .is('deleted_at', null)
    .maybeSingle()

  let declarationId: string
  if (existing) {
    declarationId = existing.id
    const { error: updateError } = await supabase
      .from('tax_declarations')
      .update({
        amount_due: input.amountDue,
        amount_paid: input.amountPaid ?? null,
        status,
        declaration_date: input.declarationDate,
        payment_date: input.paymentDate ?? null,
        declaration_reference: input.declarationReference,
        computed_snapshot: (input.computedSnapshot ?? null) as never,
        supporting_documents: (input.supportingDocumentIds ?? []) as never,
        declared_by_user_id: user.id,
        notes: input.notes ?? null,
      })
      .eq('id', declarationId)
      .eq('company_id', companyId)

    if (updateError) {
      logger.error('tax.declare.update_failed', {
        action: 'markTaxAsDeclared',
        userId: user.id,
        companyId,
        error: updateError.message,
      })
      return { data: null, error: 'Échec de la mise à jour.' }
    }
  } else {
    declarationId = crypto.randomUUID()
    const { error: insertError } = await supabase
      .from('tax_declarations')
      .insert({
        id: declarationId,
        company_id: companyId,
        declaration_type: input.declarationType,
        period_month: input.periodMonth,
        amount_due: input.amountDue,
        amount_paid: input.amountPaid ?? null,
        status,
        declaration_date: input.declarationDate,
        payment_date: input.paymentDate ?? null,
        declaration_reference: input.declarationReference,
        computed_snapshot: (input.computedSnapshot ?? null) as never,
        supporting_documents: (input.supportingDocumentIds ?? []) as never,
        declared_by_user_id: user.id,
        notes: input.notes ?? null,
      })

    if (insertError) {
      logger.error('tax.declare.insert_failed', {
        action: 'markTaxAsDeclared',
        userId: user.id,
        companyId,
        error: insertError.message,
      })
      return { data: null, error: 'Échec de l\'enregistrement.' }
    }
  }

  await recordAccountingAudit({
    companyId,
    entityType: 'tax_declaration',
    entityId: declarationId,
    action: 'send',
    afterState: {
      declaration_type: input.declarationType,
      period_month: input.periodMonth,
      amount_due: input.amountDue,
      amount_paid: input.amountPaid ?? null,
      status,
      declaration_reference: input.declarationReference,
    },
    notes: input.declarationReference,
    actor: { userId: user.id, role: user.role, name: user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite/tva', 'page')
  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  return { data: { declarationId }, error: null }
}
