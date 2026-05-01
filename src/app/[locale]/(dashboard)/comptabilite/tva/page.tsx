import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { computeVatForPeriod } from '@/actions/tax-declarations'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import type { AccountingDocumentCategory } from '@/types/database.types'
import { MarkDeclaredForm } from './mark-declared-form'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface TvaPageProps {
  searchParams: { period?: string }
}

function startOfMonthIso(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  return copy.toISOString().slice(0, 10)
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

// Morocco TVA: declaration due by the 20th of the month following
// the period (monthly regime — assumed for MASLAK).
function vatDeadline(periodIso: string): Date {
  const next = new Date(nextMonthIso(periodIso))
  next.setUTCDate(20)
  return next
}

export default async function TvaPage({ searchParams }: TvaPageProps) {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  // Default to last completed month (more useful than the current
  // open month for declaration prep).
  const today = new Date()
  const defaultPeriod = previousMonthIso(startOfMonthIso(today))
  const period = searchParams.period && /^\d{4}-\d{2}-01$/.test(searchParams.period)
    ? searchParams.period
    : defaultPeriod

  const supabase = await createClient()

  const [computeResult, existingResult] = await Promise.all([
    computeVatForPeriod({ companyId: user.companyId, periodMonth: period }),
    supabase
      .from('tax_declarations')
      .select('id, amount_due, amount_paid, status, declaration_date, declaration_reference, payment_date, declared_by_user_id')
      .eq('company_id', user.companyId)
      .eq('declaration_type', 'vat')
      .eq('period_month', period)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (computeResult.error || !computeResult.data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('tva.title')} />
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {computeResult.error ?? t('tva.loadError')}
        </p>
      </div>
    )
  }

  const data = computeResult.data
  const existing = existingResult.data

  const deadline = vatDeadline(period)
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = !existing && daysToDeadline < 0
  const isUrgent = !existing && daysToDeadline >= 0 && daysToDeadline <= 5

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
        title={t('tva.title')}
        description={t('tva.subtitle', { period: formatDate(period, dateLocale, 'MMMM yyyy') })}
      />

      {/* Period selector */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`?period=${previousMonthIso(period)}`}
          className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted"
        >
          ←
        </Link>
        <span className="px-2 font-semibold">
          {formatDate(period, dateLocale, 'MMMM yyyy')}
        </span>
        <Link
          href={`?period=${nextMonthIso(period)}`}
          aria-disabled={nextMonthIso(period) > startOfMonthIso(today)}
          className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          →
        </Link>
      </div>

      {/* Status banner */}
      {existing ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{t(`tva.status.${existing.status}`)}</p>
            <p className="text-xs">
              {t('tva.declaredOn', {
                date: formatDate(existing.declaration_date, dateLocale),
                ref: existing.declaration_reference ?? '—',
              })}
            </p>
          </div>
        </div>
      ) : isOverdue ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('tva.overdue')}</p>
            <p className="text-xs">{t('tva.deadlineWas', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
          </div>
        </div>
      ) : isUrgent ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('tva.urgent', { days: daysToDeadline })}</p>
            <p className="text-xs">{t('tva.deadline', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p>{t('tva.deadline', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={t('tva.collected')}
          value={data.vatCollected}
          tone="positive"
        />
        <SummaryCard
          label={t('tva.deductible')}
          value={data.vatDeductible}
          tone="neutral"
        />
        <SummaryCard
          label={t('tva.toPay')}
          value={data.vatToPay}
          tone={data.vatToPay >= 0 ? 'warning' : 'positive'}
          highlight
        />
      </div>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CollectedSection invoices={data.collectedRows} dateLocale={dateLocale} />
        <DeductibleSection categories={data.deductibleByCategory} />
      </div>

      {/* Action: mark as declared */}
      {!existing && (
        <MarkDeclaredForm
          period={period}
          amountDue={data.vatToPay}
          supportingDocumentIds={data.supportingDocumentIds}
          computedSnapshot={{
            vatCollected: data.vatCollected,
            vatDeductible: data.vatDeductible,
            vatToPay: data.vatToPay,
            invoicesCount: data.collectedRows.length,
            deductibleByCategory: data.deductibleByCategory,
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  highlight,
}: {
  label: string
  value: number
  tone: 'positive' | 'warning' | 'neutral'
  highlight?: boolean
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-border bg-card'
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${toneClass} ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{formatMAD(value)}</p>
    </div>
  )
}

async function CollectedSection({
  invoices,
  dateLocale,
}: {
  invoices: Array<{ id: string; reference: string; client: string | null; total_excl_tax: number; total_tax: number; issued_at: string | null }>
  dateLocale: 'fr' | 'ar'
}) {
  const t = await getTranslations('accounting')
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">{t('tva.collectedTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('tva.collectedSubtitle')}</p>
      </div>
      {invoices.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('tva.noInvoices')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">{t('tva.invoiceRef')}</th>
              <th className="px-4 py-2 text-start">{t('tva.client')}</th>
              <th className="px-4 py-2 text-end">{t('tva.amountHt')}</th>
              <th className="px-4 py-2 text-end">{t('tva.vatAmount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-mono text-xs">{i.reference}</td>
                <td className="px-4 py-2">{i.client ?? '—'}</td>
                <td className="px-4 py-2 text-end font-mono">{formatMAD(i.total_excl_tax)}</td>
                <td className="px-4 py-2 text-end font-mono text-emerald-700">{formatMAD(i.total_tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

async function DeductibleSection({
  categories,
}: {
  categories: Array<{ category: AccountingDocumentCategory; count: number; vatTotal: number; ttcTotal: number }>
}) {
  const t = await getTranslations('accounting')
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">{t('tva.deductibleTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('tva.deductibleSubtitle')}</p>
      </div>
      {categories.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('tva.noDeductible')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">{t('tva.category')}</th>
              <th className="px-4 py-2 text-end">{t('tva.docs')}</th>
              <th className="px-4 py-2 text-end">{t('tva.ttc')}</th>
              <th className="px-4 py-2 text-end">{t('tva.vatAmount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((c) => (
              <tr key={c.category}>
                <td className="px-4 py-2">{t(`categories.${c.category}`)}</td>
                <td className="px-4 py-2 text-end">{c.count}</td>
                <td className="px-4 py-2 text-end font-mono text-muted-foreground">{formatMAD(c.ttcTotal)}</td>
                <td className="px-4 py-2 text-end font-mono text-blue-700">{formatMAD(c.vatTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
