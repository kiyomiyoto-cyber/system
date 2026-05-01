'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import {
  MonthlyDossierPDF,
  type DossierData,
  type DossierExpenseRow,
  type DossierExpenseDetail,
  type DossierInvoiceRow,
  type DossierPayrollRow,
} from '@/lib/pdf/monthly-dossier-generator'
import type { ActionResult } from '@/types/app.types'
import type {
  AccountingDocumentCategory,
  AccountingDocumentStatus,
  AccountantDeliveryMethod,
} from '@/types/database.types'

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

function nextMonthIso(periodMonth: string): string {
  const d = new Date(periodMonth)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}

function formatPeriodLabel(periodMonth: string): string {
  const d = new Date(periodMonth)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function periodFolder(periodMonth: string): string {
  return periodMonth.slice(0, 7) // YYYY-MM
}

export async function generateMonthlyDossier(
  periodMonth: string,
): Promise<ActionResult<{ dossierId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    return { data: null, error: 'Période invalide (attendu YYYY-MM-01).' }
  }

  const supabase = await createClient()
  const service = await createServiceClient()
  const periodEnd = nextMonthIso(periodMonth)

  const [companyResult, invoicesResult, docsResult, payrollResult] = await Promise.all([
    supabase
      .from('companies')
      .select('name, address, city, tax_id')
      .eq('id', auth.companyId)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('id, invoice_number, total_excl_tax, total_tax, total_incl_tax, issued_at, status, client:clients(business_name)')
      .eq('company_id', auth.companyId)
      .gte('issued_at', periodMonth)
      .lt('issued_at', periodEnd)
      .neq('status', 'cancelled')
      .is('deleted_at', null)
      .order('issued_at', { ascending: true }),
    supabase
      .from('accounting_documents')
      .select('id, document_category, amount_ttc, vat_amount, document_date, supplier_name, status')
      .eq('company_id', auth.companyId)
      .gte('captured_at', periodMonth)
      .lt('captured_at', periodEnd)
      .is('deleted_at', null)
      .order('document_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('payroll_data_export')
      .select('id, driver_id, gross_salary_mad, bonuses_mad, cnss_employee_part, cnss_employer_part, amo_employee_part, amo_employer_part, family_allowance, vocational_training, ir_amount, net_salary_mad, status, driver:drivers(full_name)')
      .eq('company_id', auth.companyId)
      .eq('period_month', periodMonth)
      .in('status', ['validated', 'paid'])
      .is('deleted_at', null),
  ])

  type CompanyRow = { name: string; address: string | null; city: string | null; tax_id: string | null }
  type InvRow = {
    id: string
    invoice_number: string
    total_excl_tax: number | null
    total_tax: number | null
    total_incl_tax: number | null
    issued_at: string | null
    status: string | null
    client: { business_name: string } | null
  }
  type DocRow = {
    id: string
    document_category: AccountingDocumentCategory
    amount_ttc: number
    vat_amount: number | null
    document_date: string | null
    supplier_name: string | null
    status: AccountingDocumentStatus
  }
  type PayrollRow = {
    id: string
    driver_id: string
    gross_salary_mad: number
    bonuses_mad: number
    cnss_employee_part: number
    cnss_employer_part: number
    amo_employee_part: number
    amo_employer_part: number
    family_allowance: number
    vocational_training: number
    ir_amount: number
    net_salary_mad: number
    driver: { full_name: string } | null
  }

  const company = companyResult.data as unknown as CompanyRow | null
  const invoices = (invoicesResult.data ?? []) as unknown as InvRow[]
  const docs = (docsResult.data ?? []) as unknown as DocRow[]
  const payroll = (payrollResult.data ?? []) as unknown as PayrollRow[]

  if (!company) return { data: null, error: 'Entreprise introuvable.' }

  // Aggregate invoices
  const invoiceRows: DossierInvoiceRow[] = invoices.map((i) => ({
    reference: i.invoice_number,
    client: i.client?.business_name ?? '—',
    issuedAt: i.issued_at,
    ht: Number(i.total_excl_tax ?? 0),
    tax: Number(i.total_tax ?? 0),
    ttc: Number(i.total_incl_tax ?? 0),
    status: i.status,
  }))
  const totalRevenueExcl = invoiceRows.reduce((s, x) => s + x.ht, 0)
  const totalRevenueIncl = invoiceRows.reduce((s, x) => s + x.ttc, 0)
  const vatCollected = invoiceRows.reduce((s, x) => s + x.tax, 0)

  // Aggregate expenses (excluding invoice_client + rejected)
  const validDocs = docs.filter(
    (d) => d.status !== 'rejected' && d.document_category !== 'invoice_client',
  )
  const totalExpenses = validDocs.reduce((s, d) => s + Number(d.amount_ttc), 0)

  const byCategory = new Map<AccountingDocumentCategory, { count: number; ttc: number; vat: number }>()
  for (const d of validDocs) {
    const cur = byCategory.get(d.document_category) ?? { count: 0, ttc: 0, vat: 0 }
    cur.count += 1
    cur.ttc += Number(d.amount_ttc)
    if (
      d.vat_amount != null
      && (d.status === 'validated' || d.status === 'sent_to_accountant')
      && VAT_DEDUCTIBLE_CATEGORIES.includes(d.document_category)
    ) {
      cur.vat += Number(d.vat_amount)
    }
    byCategory.set(d.document_category, cur)
  }
  const expensesByCategory: DossierExpenseRow[] = Array.from(byCategory.entries()).map(([category, c]) => ({
    category,
    count: c.count,
    totalTtc: c.ttc,
    vatTotal: c.vat,
  }))
  const vatDeductible = expensesByCategory.reduce((s, c) => s + c.vatTotal, 0)
  const vatToPay = vatCollected - vatDeductible

  const expensesDetail: DossierExpenseDetail[] = validDocs.map((d) => ({
    date: d.document_date,
    supplier: d.supplier_name,
    category: d.document_category,
    ttc: Number(d.amount_ttc),
    vat: d.vat_amount == null ? null : Number(d.vat_amount),
  }))

  // Payroll
  const payrollRows: DossierPayrollRow[] = payroll.map((p) => ({
    driverName: p.driver?.full_name ?? '—',
    gross: Number(p.gross_salary_mad) + Number(p.bonuses_mad),
    cnssEmployee: Number(p.cnss_employee_part),
    amoEmployee: Number(p.amo_employee_part),
    ir: Number(p.ir_amount),
    net: Number(p.net_salary_mad),
  }))
  const totalPayrollGross = payrollRows.reduce((s, p) => s + p.gross, 0)
  const totalPayrollNet = payrollRows.reduce((s, p) => s + p.net, 0)
  const totalEmployerCost = payroll.reduce(
    (s, p) =>
      s
      + Number(p.gross_salary_mad)
      + Number(p.bonuses_mad)
      + Number(p.cnss_employer_part)
      + Number(p.amo_employer_part)
      + Number(p.family_allowance)
      + Number(p.vocational_training),
    0,
  )

  const periodLabel = formatPeriodLabel(periodMonth)
  const generatedAt = new Date().toISOString()

  const pdfData: DossierData = {
    companyName: company.name,
    companyIce: company.tax_id,
    companyCity: company.city,
    companyAddress: company.address,
    periodLabel,
    generatedAt,
    totals: {
      revenueExclTax: totalRevenueExcl,
      revenueInclTax: totalRevenueIncl,
      expenses: totalExpenses,
      vatCollected,
      vatDeductible,
      vatToPay,
      payrollGross: totalPayrollGross,
      payrollNet: totalPayrollNet,
      employerCost: totalEmployerCost,
      documentsCount: validDocs.length,
    },
    invoices: invoiceRows,
    expensesByCategory,
    expensesDetail,
    payroll: payrollRows,
  }

  // Render PDF (server-side)
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(MonthlyDossierPDF({ data: pdfData }))
  } catch (err) {
    logger.error('dossier.pdf_failed', {
      action: 'generateMonthlyDossier',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { data: null, error: 'Échec de la génération du PDF.' }
  }

  // Upload to Storage
  const pdfPath = `${auth.companyId}/${periodFolder(periodMonth)}/recap.pdf`
  const { error: uploadError } = await service.storage
    .from('monthly-dossiers')
    .upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadError) {
    logger.error('dossier.pdf_upload_failed', {
      action: 'generateMonthlyDossier',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: uploadError.message,
    })
    return { data: null, error: 'Échec du téléversement du PDF.' }
  }

  // Upsert dossier row
  const { data: existing } = await supabase
    .from('monthly_dossiers')
    .select('id')
    .eq('company_id', auth.companyId)
    .eq('period_month', periodMonth)
    .is('deleted_at', null)
    .maybeSingle()

  const payload = {
    status: 'ready' as const,
    total_documents_count: validDocs.length,
    total_revenue_excl_tax_mad: totalRevenueExcl,
    total_revenue_incl_tax_mad: totalRevenueIncl,
    total_expenses_mad: totalExpenses,
    vat_collected_mad: vatCollected,
    vat_deductible_mad: vatDeductible,
    vat_to_pay_mad: vatToPay,
    total_payroll_gross_mad: totalPayrollGross,
    total_payroll_net_mad: totalPayrollNet,
    total_employer_cost_mad: totalEmployerCost,
    pdf_summary_path: pdfPath,
    computed_snapshot: pdfData as never,
    generated_at: generatedAt,
    generated_by_user_id: auth.user.id,
  }

  let dossierId: string
  if (existing) {
    dossierId = existing.id
    const { error: updateError } = await supabase
      .from('monthly_dossiers')
      .update(payload)
      .eq('id', dossierId)
      .eq('company_id', auth.companyId)
    if (updateError) {
      logger.error('dossier.update_failed', { error: updateError.message })
      return { data: null, error: 'Échec de la mise à jour du dossier.' }
    }
  } else {
    dossierId = crypto.randomUUID()
    const { error: insertError } = await supabase
      .from('monthly_dossiers')
      .insert({
        id: dossierId,
        company_id: auth.companyId,
        period_month: periodMonth,
        ...payload,
      })
    if (insertError) {
      logger.error('dossier.insert_failed', { error: insertError.message })
      return { data: null, error: 'Échec de la création du dossier.' }
    }
  }

  // Link all included accounting_documents to this dossier (idempotent)
  const ids = validDocs.map((d) => d.id)
  if (ids.length > 0) {
    await supabase
      .from('accounting_documents')
      .update({ monthly_dossier_id: dossierId })
      .in('id', ids)
      .eq('company_id', auth.companyId)
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'monthly_dossier',
    entityId: dossierId,
    action: existing ? 'update' : 'create',
    afterState: {
      period_month: periodMonth,
      status: 'ready',
      total_revenue_excl_tax_mad: totalRevenueExcl,
      total_expenses_mad: totalExpenses,
      vat_to_pay_mad: vatToPay,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  revalidatePath('/[locale]/(dashboard)/comptabilite/dossiers', 'page')
  return { data: { dossierId }, error: null }
}

const accountantSchema = z.object({
  accountantName: z.string().trim().min(2).max(120),
  cabinetName: z.string().trim().max(160).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  whatsappPhone: z.string().trim().max(40).nullable().optional(),
  preferredDeliveryMethod: z.enum(['email', 'usb', 'paper', 'portal']),
  billingTerms: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export type AccountantInput = z.input<typeof accountantSchema>

export async function setAccountantProfile(
  rawInput: AccountantInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = accountantSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('accountant_profiles')
    .select('id')
    .eq('company_id', auth.companyId)
    .maybeSingle()

  let id: string
  if (existing) {
    id = existing.id
    const { error } = await supabase
      .from('accountant_profiles')
      .update({
        accountant_name: input.accountantName,
        cabinet_name: input.cabinetName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        whatsapp_phone: input.whatsappPhone ?? null,
        preferred_delivery_method: input.preferredDeliveryMethod,
        billing_terms: input.billingTerms ?? null,
        notes: input.notes ?? null,
      })
      .eq('id', id)
      .eq('company_id', auth.companyId)
    if (error) {
      logger.error('accountant.update_failed', { error: error.message })
      return { data: null, error: 'Échec de la mise à jour.' }
    }
  } else {
    id = crypto.randomUUID()
    const { error } = await supabase
      .from('accountant_profiles')
      .insert({
        id,
        company_id: auth.companyId,
        accountant_name: input.accountantName,
        cabinet_name: input.cabinetName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        whatsapp_phone: input.whatsappPhone ?? null,
        preferred_delivery_method: input.preferredDeliveryMethod,
        billing_terms: input.billingTerms ?? null,
        notes: input.notes ?? null,
      })
    if (error) {
      logger.error('accountant.insert_failed', { error: error.message })
      return { data: null, error: 'Échec de la création.' }
    }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'accountant_profile',
    entityId: id,
    action: existing ? 'update' : 'create',
    afterState: { accountant_name: input.accountantName, email: input.email, method: input.preferredDeliveryMethod },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite/parametres', 'page')
  return { data: { id }, error: null }
}

export async function sendDossierByEmail(
  dossierId: string,
): Promise<ActionResult<{ sentTo: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(dossierId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const service = await createServiceClient()

  const [dossierResult, accountantResult, companyResult] = await Promise.all([
    supabase
      .from('monthly_dossiers')
      .select('id, period_month, status, pdf_summary_path, total_revenue_excl_tax_mad, total_expenses_mad, vat_to_pay_mad')
      .eq('id', dossierId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('accountant_profiles')
      .select('email, accountant_name, cabinet_name')
      .eq('company_id', auth.companyId)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('name')
      .eq('id', auth.companyId)
      .maybeSingle(),
  ])

  type DossierRow = {
    id: string
    period_month: string
    status: string
    pdf_summary_path: string | null
    total_revenue_excl_tax_mad: number
    total_expenses_mad: number
    vat_to_pay_mad: number
  }
  const dossier = dossierResult.data as unknown as DossierRow | null
  const accountant = accountantResult.data as unknown as { email: string | null; accountant_name: string; cabinet_name: string | null } | null
  const company = companyResult.data as unknown as { name: string } | null

  if (!dossier) return { data: null, error: 'Dossier introuvable.' }
  if (!dossier.pdf_summary_path) return { data: null, error: 'Aucun PDF généré pour ce dossier.' }
  if (!accountant?.email) return { data: null, error: 'Email du comptable non configuré.' }
  if (!company) return { data: null, error: 'Entreprise introuvable.' }

  // Sign URL with 30-day TTL (per spec)
  const { data: signed, error: signError } = await service.storage
    .from('monthly-dossiers')
    .createSignedUrl(dossier.pdf_summary_path, 60 * 60 * 24 * 30)

  if (signError || !signed) {
    return { data: null, error: 'Impossible de générer le lien sécurisé.' }
  }

  const periodLabel = formatPeriodLabel(dossier.period_month)
  const fmt = (n: number) =>
    `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`

  const subject = `${company.name} — Dossier comptable ${periodLabel}`
  const htmlBody = `
    <div style="font-family: Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px;">
      <p>Bonjour ${accountant.accountant_name},</p>
      <p>Veuillez trouver ci-dessous le récapitulatif comptable de la période <strong>${periodLabel}</strong> pour <strong>${company.name}</strong>.</p>

      <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
        <tr><td style="padding: 6px 0; color: #4b5563;">Chiffre d'affaires HT</td><td style="text-align: right; font-weight: bold;">${fmt(Number(dossier.total_revenue_excl_tax_mad))}</td></tr>
        <tr><td style="padding: 6px 0; color: #4b5563;">Total charges TTC</td><td style="text-align: right; font-weight: bold;">${fmt(Number(dossier.total_expenses_mad))}</td></tr>
        <tr><td style="padding: 6px 0; background: #eef2ff; color: #1e40af; padding-left: 8px;"><strong>TVA à payer</strong></td><td style="text-align: right; font-weight: bold; background: #eef2ff; color: #1e40af; padding-right: 8px;">${fmt(Number(dossier.vat_to_pay_mad))}</td></tr>
      </table>

      <p>
        <a href="${signed.signedUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Télécharger le dossier complet (PDF)
        </a>
      </p>
      <p style="color: #6b7280; font-size: 12px;">Lien sécurisé valide 30 jours. À l'ouverture, vous accéderez au récapitulatif détaillé : factures clients, charges classées par catégorie, paie chauffeurs avec cotisations CNSS / AMO / IR.</p>

      <p>Cordialement,<br/>${company.name}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 24px;"/>
      <p style="color: #9ca3af; font-size: 11px;">Document généré automatiquement par MASLAK. Merci de ne pas répondre directement à cet email — contactez le gérant pour toute question.</p>
    </div>
  `

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.warn('dossier.email.no_api_key', { dossierId })
    return { data: null, error: 'Resend non configuré (RESEND_API_KEY manquant).' }
  }
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@maslak.local'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [accountant.email],
        subject,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error('dossier.email.send_failed', { status: res.status, body: text, dossierId })
      return { data: null, error: `Échec d'envoi (${res.status}).` }
    }
  } catch (err) {
    logger.error('dossier.email.send_error', { error: (err as Error).message, dossierId })
    return { data: null, error: 'Erreur réseau lors de l\'envoi.' }
  }

  // Mark as sent
  const sentAt = new Date().toISOString()
  await supabase
    .from('monthly_dossiers')
    .update({
      status: 'sent',
      sent_at: sentAt,
      sent_to_email: accountant.email,
      sent_method: 'email' as AccountantDeliveryMethod,
    })
    .eq('id', dossierId)
    .eq('company_id', auth.companyId)

  // Mark all linked accounting_documents as sent_to_accountant
  await supabase
    .from('accounting_documents')
    .update({ status: 'sent_to_accountant' as AccountingDocumentStatus })
    .eq('monthly_dossier_id', dossierId)
    .eq('company_id', auth.companyId)
    .eq('status', 'validated')

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'monthly_dossier',
    entityId: dossierId,
    action: 'send',
    afterState: { sent_method: 'email', sent_to_email: accountant.email, sent_at: sentAt },
    notes: `Envoyé à ${accountant.email}`,
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite', 'page')
  revalidatePath('/[locale]/(dashboard)/comptabilite/dossiers', 'page')
  return { data: { sentTo: accountant.email }, error: null }
}

export async function getSignedDossierUrl(
  dossierId: string,
): Promise<ActionResult<{ url: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(dossierId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: dossier } = await supabase
    .from('monthly_dossiers')
    .select('pdf_summary_path')
    .eq('id', dossierId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossier?.pdf_summary_path) return { data: null, error: 'PDF introuvable.' }

  const service = await createServiceClient()
  const { data, error } = await service.storage
    .from('monthly-dossiers')
    .createSignedUrl(dossier.pdf_summary_path, 60 * 60)

  if (error || !data) return { data: null, error: error?.message ?? 'Lien non disponible.' }
  return { data: { url: data.signedUrl }, error: null }
}
