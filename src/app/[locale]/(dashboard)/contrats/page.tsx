import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  FileSignature, Plus, AlertTriangle, CheckCircle2, Clock, FileX2,
  Calendar, ArrowRight, Wallet, Hash, Building2,
} from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { ClientContractStatus } from '@/types/database.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface ContractRow {
  id: string
  contract_number: string | null
  start_date: string
  end_date: string | null
  status: ClientContractStatus
  billing_mode: string
  payment_terms_days: number
  client: { id: string; business_name: string } | null
}

const STATUS_META: Record<ClientContractStatus, {
  Icon: typeof CheckCircle2
  pillBg: string
  pillText: string
  stripe: string
  dot: string
}> = {
  active:    { Icon: CheckCircle2, pillBg: 'bg-emerald-50', pillText: 'text-emerald-700', stripe: 'bg-gradient-to-b from-emerald-500 via-emerald-500 to-emerald-300', dot: 'bg-emerald-500' },
  draft:     { Icon: Clock,        pillBg: 'bg-amber-50',   pillText: 'text-amber-700',   stripe: 'bg-amber-400',                                                       dot: 'bg-amber-500' },
  expired:   { Icon: AlertTriangle, pillBg: 'bg-orange-50',  pillText: 'text-orange-700', stripe: 'bg-orange-400',                                                      dot: 'bg-orange-500' },
  cancelled: { Icon: FileX2,       pillBg: 'bg-muted',      pillText: 'text-muted-foreground', stripe: 'bg-muted-foreground/30',                                       dot: 'bg-gray-400' },
}

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const [t, locale, user, sp] = await Promise.all([
    getTranslations('contracts'),
    getLocale(),
    getAuthenticatedUser(),
    searchParams,
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('client_contracts')
    .select('id, contract_number, start_date, end_date, status, billing_mode, payment_terms_days, client:clients(id, business_name)')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('start_date', { ascending: false })

  const allRows = ((data ?? []) as unknown as ContractRow[])
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  // Filtered rows for display
  let rows = allRows
  if (sp.status && sp.status !== 'all') {
    rows = rows.filter((r) => r.status === sp.status)
  }
  if (sp.q?.trim()) {
    const q = sp.q.trim().toLowerCase()
    rows = rows.filter((r) =>
      (r.contract_number ?? '').toLowerCase().includes(q) ||
      (r.client?.business_name ?? '').toLowerCase().includes(q),
    )
  }

  // Stats
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  const stats = {
    active: allRows.filter((r) => r.status === 'active').length,
    draft: allRows.filter((r) => r.status === 'draft').length,
    expired: allRows.filter((r) => r.status === 'expired').length,
    cancelled: allRows.filter((r) => r.status === 'cancelled').length,
    expiringSoon: allRows.filter((r) =>
      r.status === 'active' &&
      r.end_date &&
      new Date(r.end_date) >= today &&
      new Date(r.end_date) <= thirtyDaysFromNow,
    ).length,
    uniqueClients: new Set(allRows.filter((r) => r.status === 'active').map((r) => r.client?.id ?? '')).size,
  }

  const statusFilters: Array<ClientContractStatus | 'all'> = ['all', 'active', 'draft', 'expired', 'cancelled']
  const activeStatusFilter = (sp.status as ClientContractStatus | 'all' | undefined) ?? 'all'
  const filterCounts: Record<string, number> = {
    all: allRows.length,
    active: stats.active,
    draft: stats.draft,
    expired: stats.expired,
    cancelled: stats.cancelled,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('list.title')}
        description={t('list.subtitle')}
        action={
          <Link
            href={`/${locale}/contrats/new`}
            className="btn-cta focus-ring"
          >
            <Plus className="h-4 w-4" />
            {t('list.newButton')}
          </Link>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.active')}
            value={stats.active}
            subtitle={t('stats.activeSubtitle')}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.expiringSoon')}
            value={stats.expiringSoon}
            subtitle={t('stats.expiringSoonSubtitle')}
            icon={AlertTriangle}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.draft')}
            value={stats.draft}
            subtitle={t('stats.draftSubtitle')}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.totalClients')}
            value={stats.uniqueClients}
            subtitle={t('stats.totalClientsSubtitle', { count: stats.uniqueClients })}
            icon={Building2}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Filters */}
      {allRows.length > 0 && (
        <FadeIn delay={0.16}>
          <div className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form className="relative flex-1 sm:max-w-md">
                <input
                  type="search"
                  name="q"
                  defaultValue={sp.q}
                  placeholder={t('list.search')}
                  className="w-full rounded-lg border bg-background ps-3 pe-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {sp.status && (
                  <input type="hidden" name="status" value={sp.status} />
                )}
              </form>

              <div className="flex flex-wrap gap-1.5">
                {statusFilters.map((s) => {
                  const active = activeStatusFilter === s
                  const count = filterCounts[s] ?? 0
                  const meta = s === 'all' ? null : STATUS_META[s]
                  const label = s === 'all' ? t('list.filterAll') : t(`status.${s}`)
                  const params = new URLSearchParams()
                  if (s !== 'all') params.set('status', s)
                  if (sp.q) params.set('q', sp.q)
                  const href = params.toString()
                    ? `/${locale}/contrats?${params.toString()}`
                    : `/${locale}/contrats`
                  return (
                    <Link
                      key={s}
                      href={href}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                          : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                      )}
                    >
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        active ? 'bg-white/80' : (meta?.dot ?? 'bg-primary'),
                      )} />
                      {label}
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        active ? 'bg-white/20' : 'bg-background',
                      )}>
                        {count}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Empty / list */}
      {allRows.length === 0 ? (
        <FadeIn delay={0.2}>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-12 text-center shadow-soft">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileSignature className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('list.empty')}</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{t('list.emptyHint')}</p>
            <Link
              href={`/${locale}/contrats/new`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
            >
              <Plus className="h-4 w-4" />
              {t('list.emptyAction')}
            </Link>
          </div>
        </FadeIn>
      ) : rows.length === 0 ? (
        <FadeIn delay={0.2}>
          <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
            <FileSignature className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('list.noResults')}</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" delayChildren={0.2}>
          {rows.map((row) => (
            <StaggerItem key={row.id}>
              <ContractCard row={row} locale={locale} dateLocale={dateLocale} t={t} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}

function ContractCard({
  row, locale, dateLocale, t,
}: {
  row: ContractRow
  locale: string
  dateLocale: 'fr' | 'ar'
  t: Awaited<ReturnType<typeof getTranslations<'contracts'>>>
}) {
  const meta = STATUS_META[row.status]
  const today = new Date()
  const start = new Date(row.start_date)
  const end = row.end_date ? new Date(row.end_date) : null

  // Period progress
  let elapsedPct: number | null = null
  let daysRemaining: number | null = null
  if (end) {
    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = today.getTime() - start.getTime()
    elapsedPct = totalMs > 0 ? Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100))) : 100
    daysRemaining = Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
  }

  const isExpiringSoon =
    row.status === 'active' && daysRemaining != null && daysRemaining >= 0 && daysRemaining <= 30
  const isExpiredActive = row.status === 'active' && daysRemaining != null && daysRemaining < 0

  return (
    <Link
      href={`/${locale}/contrats/${row.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md"
    >
      {/* Status stripe */}
      <div aria-hidden className={cn('absolute inset-y-0 start-0 w-1', meta.stripe)} />

      {/* Header */}
      <div className="flex items-start gap-3 border-b px-5 py-4 ps-6">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          meta.pillBg, meta.pillText,
        )}>
          <FileSignature className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              meta.pillBg, meta.pillText,
            )}>
              <meta.Icon className="h-2.5 w-2.5" />
              {t(`status.${row.status}`)}
            </span>
            {isExpiringSoon && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t('list.expiringSoon')}
              </span>
            )}
          </div>
          <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
            {row.client?.business_name ?? '—'}
          </h3>
          {row.contract_number && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span className="font-mono">{row.contract_number}</span>
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4 ps-6">
        {/* Period */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(row.start_date, dateLocale)}
              <ArrowRight className="h-3 w-3" />
              {row.end_date ? formatDate(row.end_date, dateLocale) : t('list.indefinitePeriod')}
            </span>
            {elapsedPct != null && (
              <span className="font-semibold tabular-nums text-muted-foreground">
                {t('list.elapsed', { pct: elapsedPct })}
              </span>
            )}
          </div>
          {elapsedPct != null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isExpiredActive ? 'bg-rose-500'
                    : isExpiringSoon ? 'bg-orange-500'
                    : 'bg-emerald-500',
                )}
                style={{ width: `${elapsedPct}%` }}
              />
            </div>
          )}
          {daysRemaining != null && (
            <p className={cn(
              'text-[11px] font-medium',
              isExpiredActive ? 'text-rose-700'
                : isExpiringSoon ? 'text-orange-700'
                : 'text-muted-foreground',
            )}>
              {daysRemaining < 0
                ? t('list.expiredAgo', { days: Math.abs(daysRemaining) })
                : t('list.daysRemaining', { days: daysRemaining })}
            </p>
          )}
        </div>

        {/* Pills */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            <Wallet className="h-3 w-3" />
            {t(`billing.${row.billing_mode}`)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {row.payment_terms_days === 0
              ? t('form.immediate')
              : t('list.termsDays', { days: row.payment_terms_days })}
          </span>
        </div>
      </div>
    </Link>
  )
}
