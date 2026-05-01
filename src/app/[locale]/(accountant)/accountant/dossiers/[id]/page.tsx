import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  StickyNote,
} from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD, formatDate, formatRelativeTime } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type {
  MonthlyDossierStatus,
  AccountantDeliveryMethod,
} from '@/types/database.types'
import { CloseDossierForm } from './close-dossier-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { locale: string; id: string }
}

interface DossierRow {
  id: string
  company_id: string
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
  zip_archive_path: string | null
  excel_export_path: string | null
  generated_at: string | null
  sent_at: string | null
  sent_to_email: string | null
  sent_method: AccountantDeliveryMethod | null
  closed_at: string | null
  notes_from_accountant: string | null
}

const STATUS_TONE: Record<MonthlyDossierStatus, string> = {
  in_progress: 'bg-slate-100 text-slate-700 ring-slate-200',
  ready: 'bg-blue-50 text-blue-700 ring-blue-200',
  sent: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed_by_accountant: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export default async function AccountantDossierDetailPage({ params }: PageProps) {
  const [t, tStatus, locale, user] = await Promise.all([
    getTranslations('accountant.dossierDetail'),
    getTranslations('accountant.dossiersList.status'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'external_accountant') redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data: dossierRaw } = await supabase
    .from('monthly_dossiers')
    .select(
      'id, company_id, period_month, status, total_documents_count, total_revenue_excl_tax_mad, total_revenue_incl_tax_mad, total_expenses_mad, vat_collected_mad, vat_deductible_mad, vat_to_pay_mad, total_payroll_gross_mad, total_payroll_net_mad, total_employer_cost_mad, pdf_summary_path, zip_archive_path, excel_export_path, generated_at, sent_at, sent_to_email, sent_method, closed_at, notes_from_accountant',
    )
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  const dossier = dossierRaw as unknown as DossierRow | null
  if (!dossier) notFound()

  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'
  const periodLabel = formatDate(dossier.period_month, dateLocale, 'MMMM yyyy')
  const margin = Number(dossier.total_revenue_excl_tax_mad) - Number(dossier.total_expenses_mad)

  // Sign artefact URLs (1h TTL — short window per CLAUDE.md security rules).
  const service = await createServiceClient()
  const [pdfSigned, zipSigned, xlsxSigned] = await Promise.all([
    dossier.pdf_summary_path
      ? service.storage.from('monthly-dossiers').createSignedUrl(dossier.pdf_summary_path, 60 * 60)
      : Promise.resolve({ data: null }),
    dossier.zip_archive_path
      ? service.storage.from('monthly-dossiers').createSignedUrl(dossier.zip_archive_path, 60 * 60)
      : Promise.resolve({ data: null }),
    dossier.excel_export_path
      ? service.storage.from('monthly-dossiers').createSignedUrl(dossier.excel_export_path, 60 * 60)
      : Promise.resolve({ data: null }),
  ])

  const pdfUrl = pdfSigned.data?.signedUrl ?? null
  const zipUrl = zipSigned.data?.signedUrl ?? null
  const xlsxUrl = xlsxSigned.data?.signedUrl ?? null

  const isClosed = dossier.status === 'closed_by_accountant'
  const canClose = dossier.status === 'sent'

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/accountant/dossiers`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('back')}
      </Link>

      <PageHeader
        title={t('title', { period: periodLabel })}
        description={
          dossier.sent_at
            ? t('subtitleSent', { when: formatRelativeTime(dossier.sent_at, dateLocale) })
            : t('subtitleNotSent')
        }
        action={
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
              STATUS_TONE[dossier.status],
            )}
          >
            {tStatus(dossier.status)}
          </span>
        }
      />

      {/* Closed banner */}
      {isClosed && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{t('closedBannerTitle')}</p>
            <p className="text-xs">
              {dossier.closed_at
                ? t('closedBannerBody', {
                    when: formatDate(dossier.closed_at, dateLocale, 'dd/MM/yyyy HH:mm'),
                  })
                : t('closedBannerBodyNoDate')}
            </p>
          </div>
        </div>
      )}

      {/* Action bar — downloads */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            {t('downloadPdf')}
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            {t('noPdf')}
          </span>
        )}

        {zipUrl && (
          <a
            href={zipUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            {t('downloadZip')}
          </a>
        )}

        {xlsxUrl && (
          <a
            href={xlsxUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            {t('downloadXlsx')}
          </a>
        )}

        {dossier.sent_to_email && (
          <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {t('sentTo', { email: dossier.sent_to_email })}
          </span>
        )}
      </div>

      {/* Totals grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('revenue')} value={formatMAD(dossier.total_revenue_excl_tax_mad)} sub={t('htShort')} />
        <Stat label={t('expenses')} value={formatMAD(dossier.total_expenses_mad)} sub={t('ttcShort')} />
        <Stat
          label={t('margin')}
          value={formatMAD(margin)}
          sub={t('marginEstimate')}
          tone={margin >= 0 ? 'positive' : 'negative'}
        />
        <Stat
          label={t('vatToPay')}
          value={formatMAD(dossier.vat_to_pay_mad)}
          sub={t('vatBreakdown', {
            collected: formatMAD(dossier.vat_collected_mad),
            deductible: formatMAD(dossier.vat_deductible_mad),
          })}
          tone="warning"
          highlight
        />
      </div>

      {/* Payroll block */}
      <section className="rounded-xl border bg-card shadow-soft">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-bold text-foreground">{t('payrollTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('payrollSubtitle')}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-1 p-5 text-sm md:grid-cols-3">
          <Row label={t('payrollGross')} value={formatMAD(dossier.total_payroll_gross_mad)} />
          <Row label={t('payrollNet')} value={formatMAD(dossier.total_payroll_net_mad)} />
          <Row label={t('employerCost')} value={formatMAD(dossier.total_employer_cost_mad)} bold />
        </dl>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <FileText className="me-1 inline h-3 w-3" />
        {t('docsCount', { count: dossier.total_documents_count })}
        {dossier.generated_at && (
          <>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {t('generatedAt', {
              when: formatRelativeTime(dossier.generated_at, dateLocale),
            })}
          </>
        )}
      </p>

      {/* Existing notes (read-only after close) */}
      {isClosed && dossier.notes_from_accountant && (
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="mb-2 inline-flex items-center gap-2 text-base font-bold text-foreground">
            <StickyNote className="h-4 w-4 text-emerald-600" />
            {t('notesTitle')}
          </h2>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm text-foreground">
            {dossier.notes_from_accountant}
          </p>
        </section>
      )}

      {/* Close form */}
      {canClose && (
        <CloseDossierForm
          dossierId={dossier.id}
          labels={{
            title: t('closeForm.title'),
            subtitle: t('closeForm.subtitle'),
            notesLabel: t('closeForm.notesLabel'),
            notesPlaceholder: t('closeForm.notesPlaceholder'),
            notesHint: t('closeForm.notesHint'),
            submit: t('closeForm.submit'),
            submitting: t('closeForm.submitting'),
            confirm: t('closeForm.confirm'),
          }}
        />
      )}
    </div>
  )
}

function Stat({
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
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'negative'
        ? 'border-red-200 bg-red-50/40'
        : tone === 'warning'
          ? 'border-amber-200 bg-amber-50/40'
          : 'border-border bg-card'
  return (
    <div
      className={cn(
        'rounded-xl border p-5 shadow-soft',
        toneClass,
        highlight && 'ring-2 ring-primary/20',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
      <dt className="text-foreground/80">{label}</dt>
      <dd className={cn('font-mono', bold ? 'font-bold text-foreground' : 'text-foreground')}>
        {value}
      </dd>
    </div>
  )
}
