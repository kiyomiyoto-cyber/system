import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Receipt, Wallet, Percent, CalendarCheck, ArrowRight, ShieldCheck, Users, FolderArchive, UserCog } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { formatMAD, formatRelativeTime } from '@/lib/utils/formatters'
import type {
  AccountingDocumentCategory,
  AccountingDocumentStatus,
} from '@/types/database.types'
import { PendingValidationTable } from './pending-validation-table'
import { MonthlyRecap } from './monthly-recap'
import { AuditLogFeed } from './audit-log-feed'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

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

interface PendingDocRow {
  id: string
  document_category: AccountingDocumentCategory
  amount_ttc: number
  amount_ht: number | null
  vat_amount: number | null
  vat_rate: number
  supplier_name: string | null
  document_date: string | null
  file_path: string
  file_type: string
  status: AccountingDocumentStatus
  captured_at: string
  notes: string | null
  rejection_reason: string | null
  captured_by: { full_name: string } | null
  vehicle: { plate_number: string } | null
  driver: { full_name: string } | null
}

interface MonthDocRow {
  document_category: AccountingDocumentCategory
  amount_ttc: number
  vat_amount: number | null
  status: AccountingDocumentStatus
}

interface AuditLogRow {
  id: string
  action: string
  entity_type: string
  entity_id: string
  notes: string | null
  actor_name: string | null
  actor_role: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  created_at: string
}

function startOfCurrentMonth(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function ComptabilitePage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)

  // For super_admin without a tenant assignment, the multi-tenant
  // impersonation flow is not yet built — direct them home.
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const companyId = user.companyId
  const supabase = await createClient()
  const monthStart = startOfCurrentMonth()

  const [pendingResult, monthResult, lastDossierResult, paymentsResult, invoicesResult, auditResult] = await Promise.all([
    supabase
      .from('accounting_documents')
      .select('id, document_category, amount_ttc, amount_ht, vat_amount, vat_rate, supplier_name, document_date, file_path, file_type, status, captured_at, notes, rejection_reason, captured_by:users!accounting_documents_captured_by_user_id_fkey(full_name), vehicle:vehicles!accounting_documents_linked_vehicle_id_fkey(plate_number), driver:drivers!accounting_documents_linked_driver_id_fkey(full_name)')
      .eq('company_id', companyId)
      .eq('status', 'pending_review')
      .is('deleted_at', null)
      .order('captured_at', { ascending: false })
      .limit(50),
    supabase
      .from('accounting_documents')
      .select('document_category, amount_ttc, vat_amount, status')
      .eq('company_id', companyId)
      .gte('captured_at', monthStart)
      .is('deleted_at', null),
    supabase
      .from('monthly_dossiers')
      .select('id, period_month, status, sent_at, sent_to_email')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1),
    supabase
      .from('invoice_payments')
      .select('amount, payment_date')
      .eq('company_id', companyId)
      .gte('payment_date', monthStart),
    supabase
      .from('invoices')
      .select('subtotal_excl_tax, tax_amount, issued_at, status')
      .eq('company_id', companyId)
      .gte('issued_at', monthStart),
    supabase
      .from('accounting_audit_log')
      .select('id, action, entity_type, entity_id, notes, actor_name, actor_role, before_state, after_state, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const pending = ((pendingResult.data ?? []) as unknown as PendingDocRow[])
  const monthDocs = ((monthResult.data ?? []) as unknown as MonthDocRow[])
  const lastSentDossier = (lastDossierResult.data?.[0] ?? null) as unknown as { id: string; period_month: string; sent_at: string | null; sent_to_email: string | null } | null
  const auditLog = ((auditResult.data ?? []) as unknown as AuditLogRow[])

  // Sign URLs for thumbnails (server-side, short TTL).
  const service = await createServiceClient()
  const signedThumbs = await Promise.all(
    pending.map(async (doc) => {
      if (doc.file_type === 'pdf') return { id: doc.id, url: null }
      const { data } = await service.storage
        .from('accounting-documents')
        .createSignedUrl(doc.file_path, 60 * 30)
      return { id: doc.id, url: data?.signedUrl ?? null }
    }),
  )
  const thumbMap = new Map(signedThumbs.map((t) => [t.id, t.url]))

  // KPI computations
  const expensesThisMonth = monthDocs
    .filter((d) => d.status !== 'rejected' && d.document_category !== 'invoice_client')
    .reduce((sum, d) => sum + Number(d.amount_ttc), 0)

  const vatDeductible = monthDocs
    .filter(
      (d) =>
        (d.status === 'validated' || d.status === 'sent_to_accountant')
        && VAT_DEDUCTIBLE_CATEGORIES.includes(d.document_category)
        && d.vat_amount != null,
    )
    .reduce((sum, d) => sum + Number(d.vat_amount), 0)

  const invoices = (invoicesResult.data ?? []) as Array<{ subtotal_excl_tax: number | null; tax_amount: number | null; status: string | null }>
  const vatCollected = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.tax_amount ?? 0), 0)
  const revenueExclTaxThisMonth = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.subtotal_excl_tax ?? 0), 0)

  const payments = (paymentsResult.data ?? []) as Array<{ amount: number | null }>
  const cashIn = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  const treasuryEstimate = cashIn - expensesThisMonth
  const vatToPay = vatCollected - vatDeductible

  const docsCountThisMonth = monthDocs.length
  const pendingCount = pending.length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title={t('kpi.documentsThisMonth')}
          value={docsCountThisMonth}
          subtitle={pendingCount > 0 ? t('kpi.pendingCount', { count: pendingCount }) : t('kpi.allValidated')}
          icon={Receipt}
          iconColor={pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
          iconBg={pendingCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'}
        />
        <KPICard
          title={t('kpi.treasury')}
          value={formatMAD(treasuryEstimate)}
          subtitle={t('kpi.treasurySubtitle', {
            inflow: formatMAD(cashIn),
            outflow: formatMAD(expensesThisMonth),
          })}
          icon={Wallet}
          iconColor={treasuryEstimate >= 0 ? 'text-emerald-600' : 'text-red-600'}
          iconBg={treasuryEstimate >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
        />
        <KPICard
          title={t('kpi.vatToPay')}
          value={formatMAD(vatToPay)}
          subtitle={t('kpi.vatSubtitle', {
            collected: formatMAD(vatCollected),
            deductible: formatMAD(vatDeductible),
          })}
          icon={Percent}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <KPICard
          title={t('kpi.lastClosing')}
          value={lastSentDossier?.sent_at ? formatRelativeTime(lastSentDossier.sent_at, locale === 'ar' ? 'ar' : 'fr') : '—'}
          subtitle={
            lastSentDossier?.sent_to_email
              ? t('kpi.lastClosingSentTo', { email: lastSentDossier.sent_to_email })
              : t('kpi.lastClosingSubtitle')
          }
          icon={CalendarCheck}
          iconColor="text-violet-600"
          iconBg="bg-violet-100"
        />
      </div>

      <PendingValidationTable
        rows={pending.map((doc) => ({
          id: doc.id,
          documentCategory: doc.document_category,
          amountTtc: doc.amount_ttc,
          amountHt: doc.amount_ht,
          vatAmount: doc.vat_amount,
          vatRate: doc.vat_rate,
          supplierName: doc.supplier_name,
          documentDate: doc.document_date,
          filePath: doc.file_path,
          fileType: doc.file_type,
          notes: doc.notes,
          capturedAt: doc.captured_at,
          capturedByName: doc.captured_by?.full_name ?? null,
          vehiclePlate: doc.vehicle?.plate_number ?? null,
          driverName: doc.driver?.full_name ?? null,
          thumbnailUrl: thumbMap.get(doc.id) ?? null,
        }))}
        canModerate={user.role === 'super_admin' || user.role === 'company_admin' || user.role === 'comptable'}
      />

      <MonthlyRecap docs={monthDocs} revenueExclTax={revenueExclTaxThisMonth} vatCollected={vatCollected} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/${locale}/comptabilite/tva`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Percent className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('quickAction.tva.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quickAction.tva.subtitle')}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl-flip" />
        </Link>
        <Link
          href={`/${locale}/comptabilite/cnss-ir`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('quickAction.cnssIr.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quickAction.cnssIr.subtitle')}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl-flip" />
        </Link>
        <Link
          href={`/${locale}/comptabilite/paie`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('quickAction.paie.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quickAction.paie.subtitle')}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl-flip" />
        </Link>
        <Link
          href={`/${locale}/comptabilite/dossiers`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <FolderArchive className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('quickAction.dossiers.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quickAction.dossiers.subtitle')}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl-flip" />
        </Link>
        <Link
          href={`/${locale}/comptabilite/parametres`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <UserCog className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('quickAction.accountant.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quickAction.accountant.subtitle')}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl-flip" />
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <Link
            href={`/${locale}/comptabilite/activite-comptable`}
            className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t('audit.viewFullFeed')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl-flip" />
          </Link>
        </div>
        <AuditLogFeed entries={auditLog} locale={locale === 'ar' ? 'ar' : 'fr'} />
      </div>
    </div>
  )
}
