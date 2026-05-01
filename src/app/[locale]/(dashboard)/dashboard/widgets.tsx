import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Truck, Users, Car, Clock, Wrench, ArrowRight,
  Activity, Package, CheckCircle2, AlertCircle, MapPin,
  PlayCircle, PauseCircle, XCircle, FileWarning,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMAD, formatRelativeTime } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'
import { FadeIn } from '@/components/motion/fade-in'

const STATUS_BAR_COLOR: Record<ShipmentStatus, string> = {
  created: 'bg-slate-400',
  assigned: 'bg-blue-500',
  picked_up: 'bg-indigo-500',
  in_transit: 'bg-amber-500',
  customs_clearance: 'bg-orange-500',
  delivered: 'bg-emerald-500',
  failed: 'bg-rose-500',
  cancelled: 'bg-gray-400',
}

const STATUS_ORDER: ShipmentStatus[] = [
  'created', 'assigned', 'picked_up', 'in_transit',
  'customs_clearance', 'delivered', 'failed', 'cancelled',
]

interface StatusBreakdownProps {
  counts: Record<ShipmentStatus, number>
  total: number
  delay?: number
}

export function StatusBreakdown({ counts, total, delay = 0 }: StatusBreakdownProps) {
  const tDash = useTranslations('dashboard')
  const tStatus = useTranslations('shipments.status')

  const visible = STATUS_ORDER.filter((s) => counts[s] > 0)

  return (
    <FadeIn delay={delay}>
      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">{tDash('statusBreakdown')}</h2>
          <span className="ms-auto text-sm font-semibold text-muted-foreground">{total}</span>
        </div>
        <div className="p-5">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Package className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{tDash('noShipmentsYet')}</p>
            </div>
          ) : (
            <>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {visible.map((s) => (
                  <div
                    key={s}
                    className={cn('h-full', STATUS_BAR_COLOR[s])}
                    style={{ width: `${(counts[s] / total) * 100}%` }}
                    title={`${tStatus(s)}: ${counts[s]}`}
                  />
                ))}
              </div>
              <ul className="mt-5 space-y-2.5">
                {visible.map((s) => {
                  const pct = (counts[s] / total) * 100
                  return (
                    <li key={s} className="flex items-center gap-3 text-sm">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_BAR_COLOR[s])} />
                      <span className="flex-1 truncate text-foreground">{tStatus(s)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      <span className="w-8 text-end font-semibold tabular-nums text-foreground">{counts[s]}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </FadeIn>
  )
}

interface FleetSnapshotProps {
  driversTotal: number
  driversAvailable: number
  vehiclesTotal: number
  vehiclesInMaintenance: number
  delay?: number
}

export function FleetSnapshot({
  driversTotal, driversAvailable, vehiclesTotal, vehiclesInMaintenance, delay = 0,
}: FleetSnapshotProps) {
  const tDash = useTranslations('dashboard')

  const driversBusy = Math.max(driversTotal - driversAvailable, 0)
  const vehiclesActive = Math.max(vehiclesTotal - vehiclesInMaintenance, 0)
  const utilization = driversTotal > 0
    ? Math.round((driversBusy / driversTotal) * 100)
    : 0

  return (
    <FadeIn delay={delay}>
      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Truck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">{tDash('fleetSnapshot')}</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {/* Drivers */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tDash('driversAvailable')}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {driversAvailable}
              <span className="text-base font-normal text-muted-foreground"> / {driversTotal}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {driversBusy} {tDash('driversBusy')}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${driversTotal > 0 ? (driversAvailable / driversTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Vehicles */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Car className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tDash('vehiclesActive')}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {vehiclesActive}
              <span className="text-base font-normal text-muted-foreground"> / {vehiclesTotal}</span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" />
              {vehiclesInMaintenance} {tDash('vehiclesInMaintenance')}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${vehiclesTotal > 0 ? (vehiclesActive / vehiclesTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="border-t bg-muted/20 px-5 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tDash('fleetUtilization')}</span>
            <span className="font-semibold text-foreground">{utilization}%</span>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

interface RevenueDay {
  date: string
  amount: number
}

interface RevenueTrendProps {
  days: RevenueDay[]
  totalCurrent: number
  totalPrevious: number
  delay?: number
}

export function RevenueTrend({ days, totalCurrent, totalPrevious, delay = 0 }: RevenueTrendProps) {
  const tDash = useTranslations('dashboard')

  const max = Math.max(...days.map((d) => d.amount), 1)
  const variation = totalPrevious > 0
    ? ((totalCurrent - totalPrevious) / totalPrevious) * 100
    : null
  const positive = (variation ?? 0) >= 0

  // SVG line chart
  const w = 100
  const h = 40
  const points = days.map((d, i) => {
    const x = days.length === 1 ? w / 2 : (i / (days.length - 1)) * w
    const y = h - (d.amount / max) * h * 0.85 - h * 0.05
    return { x, y, ...d }
  })
  const pathLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
  const pathArea = `${pathLine} L${w},${h} L0,${h} Z`

  return (
    <FadeIn delay={delay}>
      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{tDash('revenueTrend')}</h2>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {tDash('last7Days')}
          </span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {formatMAD(totalCurrent)}
            </p>
            {variation != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  positive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700',
                )}
              >
                {positive ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">{tDash('vsLastPeriod')}</span>
          </div>

          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="mt-5 h-32 w-full"
            role="img"
          >
            <defs>
              <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={pathArea} fill="url(#rev-gradient)" />
            <path
              d={pathLine}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="0.9"
                fill="hsl(var(--primary))"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {days.map((d, i) => (
              <span key={i} className="tabular-nums">
                {new Date(d.date).toLocaleDateString('fr-MA', { weekday: 'short' }).slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

interface TopClientsProps {
  clients: { id: string; name: string; revenue: number; shipments: number }[]
  locale: string
  delay?: number
}

export function TopClients({ clients, locale, delay = 0 }: TopClientsProps) {
  const tDash = useTranslations('dashboard')
  const max = Math.max(...clients.map((c) => c.revenue), 1)

  return (
    <FadeIn delay={delay}>
      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{tDash('topClients')}</h2>
          </div>
          <Link
            href={`/${locale}/clients`}
            className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {tDash('viewAll')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="p-2">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">{tDash('noClientRevenue')}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {clients.map((c, i) => {
                const pct = (c.revenue / max) * 100
                return (
                  <li key={c.id} className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        i === 0 && 'bg-amber-100 text-amber-700',
                        i === 1 && 'bg-slate-100 text-slate-700',
                        i === 2 && 'bg-orange-100 text-orange-700',
                        i > 2 && 'bg-muted text-muted-foreground',
                      )}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
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
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {tDash('shipmentsCount', { count: c.shipments })}
                          </span>
                        </div>
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
  )
}

interface ActivityItem {
  id: string
  shipmentId: string
  reference: string
  status: ShipmentStatus
  driverName: string | null
  createdAt: string
}

interface ActivityFeedProps {
  items: ActivityItem[]
  locale: string
  delay?: number
}

const STATUS_ICON: Record<ShipmentStatus, { Icon: typeof Package; bg: string; color: string }> = {
  created: { Icon: Package, bg: 'bg-slate-100', color: 'text-slate-700' },
  assigned: { Icon: Users, bg: 'bg-blue-100', color: 'text-blue-700' },
  picked_up: { Icon: PlayCircle, bg: 'bg-indigo-100', color: 'text-indigo-700' },
  in_transit: { Icon: MapPin, bg: 'bg-amber-100', color: 'text-amber-700' },
  customs_clearance: { Icon: PauseCircle, bg: 'bg-orange-100', color: 'text-orange-700' },
  delivered: { Icon: CheckCircle2, bg: 'bg-emerald-100', color: 'text-emerald-700' },
  failed: { Icon: AlertCircle, bg: 'bg-rose-100', color: 'text-rose-700' },
  cancelled: { Icon: XCircle, bg: 'bg-gray-100', color: 'text-gray-500' },
}

export function ActivityFeed({ items, locale, delay = 0 }: ActivityFeedProps) {
  const tDash = useTranslations('dashboard')

  const messageKey: Record<ShipmentStatus, 'activityCreated' | 'activityAssigned' | 'activityPickedUp' | 'activityInTransit' | 'activityDelivered' | 'activityFailed' | 'activityCustoms' | 'activityCancelled'> = {
    created: 'activityCreated',
    assigned: 'activityAssigned',
    picked_up: 'activityPickedUp',
    in_transit: 'activityInTransit',
    customs_clearance: 'activityCustoms',
    delivered: 'activityDelivered',
    failed: 'activityFailed',
    cancelled: 'activityCancelled',
  }

  return (
    <FadeIn delay={delay}>
      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">{tDash('activityFeed')}</h2>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">{tDash('noActivity')}</p>
            </div>
          ) : (
            <ol className="relative px-5 py-4">
              <span aria-hidden className="absolute inset-y-4 start-[27px] w-px bg-border" />
              {items.map((it) => {
                const { Icon, bg, color } = STATUS_ICON[it.status]
                return (
                  <li key={it.id} className="relative flex gap-3 py-2">
                    <div className={cn(
                      'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                      bg,
                    )}>
                      <Icon className={cn('h-3 w-3', color)} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <Link
                        href={`/${locale}/shipments/${it.shipmentId}`}
                        className="block truncate text-sm text-foreground hover:underline"
                      >
                        {tDash(messageKey[it.status], {
                          ref: it.reference,
                          driver: it.driverName ?? '—',
                        })}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(it.createdAt, locale as 'fr' | 'ar')}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </FadeIn>
  )
}

interface QuickStatsProps {
  clients: number
  drivers: number
  vehicles: number
  pendingInvoices: number
  pendingInvoicesAmount: number
  locale: string
  delay?: number
}

export function QuickStats({
  clients, drivers, vehicles, pendingInvoices, pendingInvoicesAmount, locale, delay = 0,
}: QuickStatsProps) {
  const tDash = useTranslations('dashboard')

  const items = [
    {
      label: tDash('totalClients'),
      value: clients,
      Icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      href: `/${locale}/clients`,
    },
    {
      label: tDash('totalDrivers'),
      value: drivers,
      Icon: Truck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      href: `/${locale}/drivers`,
    },
    {
      label: tDash('totalVehicles'),
      value: vehicles,
      Icon: Car,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      href: `/${locale}/vehicles`,
    },
    {
      label: tDash('pendingInvoices'),
      value: pendingInvoices,
      sub: formatMAD(pendingInvoicesAmount),
      Icon: FileWarning,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      href: `/${locale}/invoices?status=unpaid`,
    },
  ]

  return (
    <FadeIn delay={delay}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-md focus-ring"
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
              it.bg,
            )}>
              <it.Icon className={cn('h-5 w-5', it.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {it.label}
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{it.value}</p>
              {it.sub && (
                <p className="truncate text-xs text-muted-foreground">{it.sub}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </FadeIn>
  )
}
