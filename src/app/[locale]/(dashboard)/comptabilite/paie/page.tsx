import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { loadOrInitMonthlyPayroll } from '@/actions/payroll'
import { PageHeader } from '@/components/shared/page-header'
import { formatDate } from '@/lib/utils/formatters'
import { PayrollTable } from './payroll-table'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface PaiePageProps {
  searchParams: { period?: string }
}

function startOfMonthIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

function previousMonthIso(periodIso: string): string {
  const d = new Date(periodIso)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return startOfMonthIso(d)
}

function nextMonthIso(periodIso: string): string {
  const d = new Date(periodIso)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return startOfMonthIso(d)
}

export default async function PaiePage({ searchParams }: PaiePageProps) {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const today = new Date()
  const defaultPeriod = previousMonthIso(startOfMonthIso(today))
  const period = searchParams.period && /^\d{4}-\d{2}-01$/.test(searchParams.period)
    ? searchParams.period
    : defaultPeriod

  const result = await loadOrInitMonthlyPayroll(period)
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

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
        title={t('paie.title')}
        description={t('paie.subtitle', { period: formatDate(period, dateLocale, 'MMMM yyyy') })}
      />

      <div className="flex items-center gap-2 text-sm">
        <Link href={`?period=${previousMonthIso(period)}`} className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">←</Link>
        <span className="px-2 font-semibold">{formatDate(period, dateLocale, 'MMMM yyyy')}</span>
        <Link href={`?period=${nextMonthIso(period)}`} className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">→</Link>
      </div>

      {result.error || !result.data ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {result.error ?? t('paie.loadError')}
        </p>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('paie.noDrivers')}
        </p>
      ) : (
        <PayrollTable initialLines={result.data} period={period} />
      )}
    </div>
  )
}
