import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, FileText, Send, CheckCircle2, Clock } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD, formatDate, formatRelativeTime } from '@/lib/utils/formatters'
import type { MonthlyDossierStatus } from '@/types/database.types'
import { GenerateDossierButton } from './generate-dossier-button'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface DossierRow {
  id: string
  period_month: string
  status: MonthlyDossierStatus
  total_revenue_excl_tax_mad: number
  total_expenses_mad: number
  vat_to_pay_mad: number
  total_documents_count: number
  generated_at: string | null
  sent_at: string | null
  sent_to_email: string | null
  sent_method: string | null
}

function previousMonthIso(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export default async function DossiersListPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('monthly_dossiers')
    .select('id, period_month, status, total_revenue_excl_tax_mad, total_expenses_mad, vat_to_pay_mad, total_documents_count, generated_at, sent_at, sent_to_email, sent_method')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('period_month', { ascending: false })
    .limit(36)

  const rows = ((data ?? []) as unknown as DossierRow[])
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'
  const previousPeriod = previousMonthIso()
  const hasCurrentDossier = rows.some((r) => r.period_month === previousPeriod)

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/comptabilite`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('tva.backToAccounting')}
      </Link>

      <PageHeader
        title={t('dossiers.title')}
        description={t('dossiers.subtitle')}
        action={
          !hasCurrentDossier ? (
            <GenerateDossierButton period={previousPeriod} label={t('dossiers.generateButton', { period: formatDate(previousPeriod, dateLocale, 'MMMM yyyy') })} />
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">{t('dossiers.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('dossiers.emptyHint')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/${locale}/comptabilite/dossiers/${row.id}`}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft-md sm:flex-row sm:items-center"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {formatDate(row.period_month, dateLocale, 'MMMM yyyy')}
                    </h3>
                    <StatusPill status={row.status} t={t} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dossiers.summary', {
                      revenue: formatMAD(row.total_revenue_excl_tax_mad),
                      expenses: formatMAD(row.total_expenses_mad),
                      vat: formatMAD(row.vat_to_pay_mad),
                      docs: row.total_documents_count,
                    })}
                  </p>
                  {row.sent_at && row.sent_to_email && (
                    <p className="mt-1 text-xs text-emerald-700">
                      {t('dossiers.sentInfo', {
                        email: row.sent_to_email,
                        when: formatRelativeTime(row.sent_at, dateLocale),
                      })}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface StatusPillProps {
  status: MonthlyDossierStatus
  t: Awaited<ReturnType<typeof getTranslations<'accounting'>>>
}

function StatusPill({ status, t }: StatusPillProps) {
  const tone =
    status === 'in_progress' ? 'bg-amber-100 text-amber-900'
      : status === 'ready' ? 'bg-blue-100 text-blue-900'
      : status === 'sent' ? 'bg-emerald-100 text-emerald-900'
      : 'bg-violet-100 text-violet-900'
  const Icon = status === 'in_progress' ? Clock : status === 'sent' || status === 'closed_by_accountant' ? CheckCircle2 : Send
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      <Icon className="h-2.5 w-2.5" />
      {t(`dossiers.status.${status}`)}
    </span>
  )
}
