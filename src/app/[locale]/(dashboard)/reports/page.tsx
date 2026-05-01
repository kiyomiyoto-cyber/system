import { getTranslations, getLocale } from 'next-intl/server'
import {
  TrendingUp, Package, DollarSign, Truck, Star, Users, Award,
  CheckCircle2, Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatMAD, formatDistance } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

interface DriverPerf {
  id: string
  full_name: string
  total_deliveries: number | null
  on_time_delivery_rate: number | null
  average_rating: number | null
  total_km_driven: number | null
}

interface ClientRevenueRow {
  client_id: string
  client_name: string
  shipments: number
  revenue: number
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
] as const

function avatarTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export default async function ReportsPage() {
  const [t, , user, supabase] = await Promise.all([
    getTranslations('reports'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null
  const companyId = user.companyId
  const startOfMonth = (() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()

  const [{ data: kpis }, { data: drivers }, { data: monthInvoices }, { data: vehiclesRes }] = await Promise.all([
    supabase.from('v_shipment_kpis').select('*').eq('company_id', companyId).single(),
    supabase
      .from('drivers')
      .select('id, full_name, total_deliveries, on_time_delivery_rate, average_rating, total_km_driven')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('total_deliveries', { ascending: false })
      .limit(10),
    supabase
      .from('invoices')
      .select('client_id, total_incl_tax, client:clients(business_name)')
      .eq('company_id', companyId)
      .gte('issued_at', startOfMonth.slice(0, 10)),
    supabase
      .from('vehicles')
      .select('id, is_available')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null),
  ])

  const driverRows = (drivers ?? []) as DriverPerf[]

  // Derive top clients
  const clientMap = new Map<string, ClientRevenueRow>()
  for (const inv of monthInvoices ?? []) {
    const id = (inv as { client_id: string }).client_id
    const c = (inv as { client: { business_name: string } | null }).client
    const total = Number((inv as { total_incl_tax: number }).total_incl_tax ?? 0)
    if (!id) continue
    const entry = clientMap.get(id) ?? {
      client_id: id,
      client_name: c?.business_name ?? '—',
      shipments: 0,
      revenue: 0,
    }
    entry.revenue += total
    entry.shipments += 1
    clientMap.set(id, entry)
  }
  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
  const maxRevenue = Math.max(1, ...topClients.map((c) => c.revenue))

  // Fleet utilization
  const fleetTotal = vehiclesRes?.length ?? 0
  const fleetBusy = vehiclesRes?.filter((v) => !(v as { is_available: boolean }).is_available).length ?? 0
  const fleetUtilization = fleetTotal > 0 ? Math.round((fleetBusy / fleetTotal) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('totalShipments')}
            value={kpis?.total_all_time ?? 0}
            subtitle={t('monthShipments')}
            icon={Package}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('totalRevenue')}
            value={formatMAD(kpis?.revenue_this_month ?? 0)}
            subtitle={t('monthRevenue')}
            icon={DollarSign}
            iconColor="text-[hsl(var(--cta))]"
            iconBg="bg-[hsl(var(--cta))]/10"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('onTimeRate')}
            value={kpis?.on_time_rate_pct != null ? `${kpis.on_time_rate_pct.toFixed(1)}%` : '—'}
            subtitle={t('monthShipments')}
            icon={TrendingUp}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('activeFleet')}
            value={`${fleetBusy}/${fleetTotal}`}
            subtitle={`${fleetUtilization}% ${t('fleetUtilization').toLowerCase()}`}
            icon={Truck}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Two-column: top clients + driver leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top clients revenue chart */}
        <FadeIn delay={0.18} className="lg:col-span-1">
          <div className="flex h-full flex-col rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">{t('topClients')}</h2>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('topClientsSubtitle', { count: topClients.length })}
              </span>
            </div>
            <div className="flex-1 p-4">
              {topClients.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                  <Activity className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{t('noTopClients')}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {topClients.map((c, idx) => {
                    const pct = (c.revenue / maxRevenue) * 100
                    return (
                      <li key={c.client_id} className="flex items-start gap-3">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          idx === 0 && 'bg-amber-100 text-amber-700',
                          idx === 1 && 'bg-slate-100 text-slate-700',
                          idx === 2 && 'bg-orange-100 text-orange-700',
                          idx > 2 && 'bg-muted text-muted-foreground',
                        )}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {c.client_name}
                            </p>
                            <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                              {formatMAD(c.revenue)}
                            </p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {c.shipments}
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Driver performance leaderboard */}
        <FadeIn delay={0.26} className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-xl border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <Award className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">{t('performanceLeaders')}</h2>
            </div>
            <div className="overflow-x-auto">
              {driverRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Truck className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('rank')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('driver')}
                      </th>
                      <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('deliveries')}
                      </th>
                      <th className="hidden px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">
                        {t('onTimeRate')}
                      </th>
                      <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('rating')}
                      </th>
                      <th className="hidden px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                        {t('totalKm')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {driverRows.map((d, idx) => (
                      <tr key={d.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          {idx === 0 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
                              <Award className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                              {idx + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
                              avatarTone(d.id),
                            )}>
                              {initials(d.full_name)}
                            </span>
                            <span className="font-medium text-foreground">{d.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end font-bold tabular-nums">
                          {d.total_deliveries ?? 0}
                        </td>
                        <td className="hidden px-4 py-3 text-end sm:table-cell">
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                            (d.on_time_delivery_rate ?? 0) >= 90
                              ? 'bg-emerald-100 text-emerald-700'
                              : (d.on_time_delivery_rate ?? 0) >= 70
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700',
                          )}>
                            <CheckCircle2 className="h-3 w-3" />
                            {d.on_time_delivery_rate?.toFixed(0) ?? 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <span className="inline-flex items-center gap-1">
                            <span className="font-semibold text-foreground">
                              {d.average_rating ? d.average_rating.toFixed(1) : '—'}
                            </span>
                            {d.average_rating ? (
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            ) : null}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-end text-xs text-muted-foreground md:table-cell">
                          {formatDistance(d.total_km_driven ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
