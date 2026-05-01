import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, Download, FileText, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD, formatDate, formatRelativeTime } from '@/lib/utils/formatters'
import type { MonthlyDossierStatus, AccountantDeliveryMethod } from '@/types/database.types'
import { GenerateDossierButton } from '../generate-dossier-button'
import { SendDossierButton } from './send-dossier-button'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface PageProps {
  params: { locale: string; id: string }
}

interface DossierRow {
  id: string
  period_month: string
  status: MonthlyDossierStatus
  total_documents_count: number
  total_revenue_excl_tax_mad: number
  total_revenue_incl_tax_mad: number
  total_expenses_mad: number
  vat_collected_mad: number
  vat_deductible_mad: number
  vat_to_pay_mad: number
  total_payroll_gross_mad: number
  total_payroll_net_mad: number
  total_employer_cost_mad: number
  pdf_summary_path: string | null
  generated_at: string | null
  sent_at: string | null
  sent_to_email: string | null
  sent_method: AccountantDeliveryMethod | null
  notes_from_accountant: string | null
}

interface AccountantRow {
  email: string | null
  accountant_name: string
  preferred_delivery_method: AccountantDeliveryMethod
}

export default async function DossierDetailPage({ params }: PageProps) {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [dossierResult, accountantResult] = await Promise.all([
    supabase
      .from('monthly_dossiers')
      .select('*')
      .eq('id', params.id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('accountant_profiles')
      .select('email, accountant_name, preferred_delivery_method')
      .eq('company_id', user.companyId)
      .maybeSingle(),
  ])

  const dossier = dossierResult.data as unknown as DossierRow | null
  const accountant = accountantResult.data as unknown as AccountantRow | null

  if (!dossier) notFound()

  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  // Pre-sign PDF URL for direct download (60 min)
  let pdfUrl: string | null = null
  if (dossier.pdf_summary_path) {
    const service = await createServiceClient()
    const { data } = await service.storage
      .from('monthly-dossiers')
      .createSignedUrl(dossier.pdf_summary_path, 60 * 60)
    pdfUrl = data?.signedUrl ?? null
  }

  const margin = Number(dossier.total_revenue_excl_tax_mad) - Number(dossier.total_expenses_mad)

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/comptabilite/dossiers`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('dossiers.backToList')}
      </Link>

      <PageHeader
        title={t('dossiers.detail.title', { period: formatDate(dossier.period_month, dateLocale, 'MMMM yyyy') })}
        description={
          dossier.generated_at
            ? t('dossiers.detail.generatedAt', { when: formatRelativeTime(dossier.generated_at, dateLocale) })
            : t('dossiers.detail.notGenerated')
        }
      />

      {/* Status banner */}
      {dossier.status === 'sent' && dossier.sent_to_email ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('dossiers.detail.sentTitle')}</p>
            <p className="text-xs">{t('dossiers.detail.sentBody', {
              email: dossier.sent_to_email,
              when: formatDate(dossier.sent_at, dateLocale),
              method: t(`dossiers.method.${dossier.sent_method ?? 'email'}`),
            })}</p>
          </div>
        </div>
      ) : null}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <GenerateDossierButton
          period={dossier.period_month}
          label={t('dossiers.detail.regenerate')}
          variant="secondary"
        />
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            {t('dossiers.detail.downloadPdf')}
          </a>
        )}
        {dossier.status === 'ready' || dossier.status === 'sent' ? (
          accountant?.email ? (
            <SendDossierButton
              dossierId={dossier.id}
              accountantEmail={accountant.email}
              alreadySent={dossier.status === 'sent'}
              labelSend={t('dossiers.detail.sendByEmail', { email: accountant.email })}
              labelResend={t('dossiers.detail.resendByEmail')}
              confirmResend={t('dossiers.detail.confirmResend')}
            />
          ) : (
            <Link
              href={`/${locale}/comptabilite/parametres`}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              {t('dossiers.detail.configureAccountant')}
            </Link>
          )
        ) : null}
      </div>

      {/* Totals grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card label={t('dossiers.detail.revenue')} value={formatMAD(dossier.total_revenue_excl_tax_mad)} sub={t('dossiers.detail.htShort')} />
        <Card label={t('dossiers.detail.expenses')} value={formatMAD(dossier.total_expenses_mad)} sub={t('dossiers.detail.ttcShort')} />
        <Card label={t('dossiers.detail.margin')} value={formatMAD(margin)} sub={t('dossiers.detail.estimated')} tone={margin >= 0 ? 'positive' : 'negative'} />
        <Card label={t('dossiers.detail.vatToPay')} value={formatMAD(dossier.vat_to_pay_mad)} sub={t('kpi.vatSubtitle', { collected: formatMAD(dossier.vat_collected_mad), deductible: formatMAD(dossier.vat_deductible_mad) })} tone="warning" highlight />
      </div>

      {/* Payroll block */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-foreground">{t('dossiers.detail.payrollTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('dossiers.detail.payrollSubtitle')}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-2 p-5 text-sm md:grid-cols-3">
          <Stat label={t('dossiers.detail.payrollGross')} value={formatMAD(dossier.total_payroll_gross_mad)} />
          <Stat label={t('dossiers.detail.payrollNet')} value={formatMAD(dossier.total_payroll_net_mad)} />
          <Stat label={t('dossiers.detail.employerCost')} value={formatMAD(dossier.total_employer_cost_mad)} bold />
        </dl>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <FileText className="me-1 inline h-3 w-3" />
        {t('dossiers.detail.docsCount', { count: dossier.total_documents_count })}
      </p>
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  tone,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative' | 'warning'
  highlight?: boolean
}) {
  const toneClass =
    tone === 'positive' ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'negative' ? 'border-red-200 bg-red-50/40'
      : tone === 'warning' ? 'border-amber-200 bg-amber-50/40'
      : 'border-border bg-card'
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${toneClass} ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Stat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
      <dt className="text-foreground/80">{label}</dt>
      <dd className={`font-mono ${bold ? 'font-bold text-foreground' : 'text-foreground'}`}>{value}</dd>
    </div>
  )
}
