import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Plus, Package, Search, Truck, CheckCircle2, DollarSign,
  ArrowRight, MapPin, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ExcelExportLink } from '@/components/shared/excel-export-link'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatMAD, formatDate, formatRelativeTime } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { ShipmentStatus } from '@/types/database.types'

const STATUSES: ShipmentStatus[] = [
  'created', 'assigned', 'picked_up', 'in_transit',
  'delivered', 'failed', 'cancelled',
]

const STATUS_DOT: Record<ShipmentStatus, string> = {
  created: 'bg-slate-400',
  assigned: 'bg-blue-500',
  picked_up: 'bg-indigo-500',
  in_transit: 'bg-amber-500',
  customs_clearance: 'bg-orange-500',
  delivered: 'bg-emerald-500',
  failed: 'bg-rose-500',
  cancelled: 'bg-gray-400',
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; client?: string }>
}) {
  const [t, locale, user, supabase, sp] = await Promise.all([
    getTranslations('shipments'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null
  const companyId = user.companyId
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  let query = supabase
    .from('shipments')
    .select(`
      id, reference, status, pickup_city, delivery_city,
      delivery_scheduled_at, price_incl_tax, created_at,
      client:clients(business_name),
      driver:drivers(full_name)
    `)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (sp.status && sp.status !== 'all') query = query.eq('status', sp.status as ShipmentStatus)
  if (sp.client) query = query.eq('client_id', sp.client)
  if (sp.q) query = query.ilike('reference', `%${sp.q}%`)

  const [{ data: shipments }, { data: kpis }, statusCountsRes] = await Promise.all([
    query.limit(100),
    supabase
      .from('v_shipment_kpis')
      .select('*')
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('shipments')
      .select('status')
      .eq('company_id', companyId)
      .is('deleted_at', null),
  ])

  const activeFilter = sp.status ?? 'all'

  // Status counts for filter pills
  const statusCounts: Record<string, number> = { all: 0 }
  for (const s of STATUSES) statusCounts[s] = 0
  for (const row of statusCountsRes.data ?? []) {
    statusCounts.all++
    const k = (row as { status: string }).status
    if (statusCounts[k] != null) statusCounts[k]++
  }

  const onTimeRate = kpis?.on_time_rate_pct != null
    ? kpis.on_time_rate_pct.toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex items-center gap-2">
            <ExcelExportLink
              href={`/api/exports/shipments${sp.status ? `?status=${encodeURIComponent(sp.status)}` : ''}`}
              label={t('exportExcel')}
            />
            <Link
              href={`/${locale}/shipments/new`}
              className="btn-cta focus-ring"
            >
              <Plus className="h-4 w-4" />
              {t('newShipment')}
            </Link>
          </div>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.total')}
            value={kpis?.total_all_time ?? 0}
            subtitle={t('stats.totalSubtitle')}
            icon={Package}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.inTransit')}
            value={kpis?.active_shipments ?? 0}
            subtitle={t('stats.inTransitSubtitle')}
            icon={Truck}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.deliveredMonth')}
            value={kpis?.delivered_this_month ?? 0}
            subtitle={t('stats.deliveredSubtitle', { rate: onTimeRate })}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.revenueMonth')}
            value={formatMAD(kpis?.revenue_this_month ?? 0)}
            subtitle={t('stats.revenueSubtitle', { count: kpis?.delivered_this_month ?? 0 })}
            icon={DollarSign}
            iconColor="text-[hsl(var(--cta))]"
            iconBg="bg-[hsl(var(--cta))]/10"
          />
        </StaggerItem>
      </Stagger>

      {/* Filters bar */}
      <FadeIn delay={0.16}>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <form className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={sp.q}
              placeholder={t('searchByReference')}
              className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </form>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <FilterPill
              href={`/${locale}/shipments`}
              active={activeFilter === 'all'}
              label={t('allStatuses')}
              count={statusCounts.all}
              dotClass="bg-primary"
            />
            {STATUSES.map((s) => (
              <FilterPill
                key={s}
                href={`/${locale}/shipments?status=${s}`}
                active={activeFilter === s}
                label={t(`status.${s}`)}
                count={statusCounts[s] ?? 0}
                dotClass={STATUS_DOT[s]}
              />
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.22}>
        <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
          {shipments && shipments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('reference')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('client')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('route')}
                    </th>
                    <th className="hidden px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                      {t('driver')}
                    </th>
                    <th className="hidden px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                      {t('scheduledDelivery')}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('totalPrice')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('status.label')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shipments.map((s) => {
                    const client = s.client as { business_name: string } | null
                    const driver = s.driver as { full_name: string } | null
                    return (
                      <tr key={s.id} className="group transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/${locale}/shipments/${s.id}`}
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {s.reference}
                            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatRelativeTime(s.created_at, dateLocale)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {client?.business_name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 text-muted-foreground/60" />
                            {s.pickup_city}
                            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                            {s.delivery_city}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          {driver?.full_name ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                                {initials(driver.full_name)}
                              </span>
                              <span className="text-sm text-foreground">{driver.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm italic text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                          {s.delivery_scheduled_at ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(s.delivery_scheduled_at, dateLocale)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-end font-semibold tabular-nums text-foreground">
                          {formatMAD(s.price_incl_tax ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : statusCounts.all === 0 ? (
            <EmptyState locale={locale} t={t} />
          ) : (
            <NoResults t={t} />
          )}
        </div>
      </FadeIn>
    </div>
  )
}

function FilterPill({
  href, active, label, count, dotClass,
}: {
  href: string; active: boolean; label: string; count: number; dotClass: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-soft'
          : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white/80' : dotClass)} />
      {label}
      <span className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
        active ? 'bg-white/20' : 'bg-background',
      )}>
        {count}
      </span>
    </Link>
  )
}

function EmptyState({ locale, t }: { locale: string; t: (key: string) => string }) {
  return (
    <div className="relative overflow-hidden p-12 text-center">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Package className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold text-foreground">{t('noShipments')}</p>
      <Link
        href={`/${locale}/shipments/new`}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
      >
        <Plus className="h-4 w-4" />
        {t('newShipment')}
      </Link>
    </div>
  )
}

function NoResults({ t }: { t: (key: string) => string }) {
  return (
    <div className="p-10 text-center">
      <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t('noResults')}</p>
    </div>
  )
}
