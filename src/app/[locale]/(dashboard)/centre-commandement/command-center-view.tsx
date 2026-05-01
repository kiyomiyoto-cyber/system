'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Bell,
  Clock,
  ExternalLink,
  FileWarning,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Radio,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { formatMAD } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

type ActiveStatus = 'assigned' | 'picked_up' | 'in_transit' | 'customs_clearance'

const KANBAN_COLUMNS: ActiveStatus[] = [
  'assigned',
  'picked_up',
  'in_transit',
  'customs_clearance',
]

export interface ActiveMissionDTO {
  id: string
  reference: string
  status: ActiveStatus
  pickupCity: string
  deliveryCity: string
  pickupScheduledAt: string | null
  deliveryScheduledAt: string | null
  deliveryDeadlineAt: string | null
  isJit: boolean
  isInternational: boolean
  updatedAt: string
  clientName: string | null
  driver: {
    id: string
    fullName: string
    phone: string
    whatsappPhone: string | null
  } | null
  vehiclePlate: string | null
}

export interface DeliveredTodayDTO {
  id: string
  reference: string
  pickupCity: string
  deliveryCity: string
  deliveryActualAt: string | null
  deliveryDeadlineAt: string | null
  latenessMinutes: number | null
  isJit: boolean
  clientName: string | null
  driverName: string | null
}

export interface TodayProgramDTO {
  id: string
  reference: string
  status: string
  pickupCity: string
  deliveryCity: string
  deliveryScheduledAt: string | null
  isJit: boolean
  clientName: string | null
}

export interface DriverDTO {
  id: string
  fullName: string
  phone: string
  whatsappPhone: string | null
  isAvailable: boolean
  currentMission: { reference: string; deliveryCity: string; status: string } | null
}

export interface WorkSessionDTO {
  id: string
  userId: string
  role: string
  checkInAt: string
  checkOutAt: string | null
  userName: string | null
  userRole: string
}

export interface JitAlertDTO {
  id: string
  reference: string
  clientName: string | null
  riskBand: 'late' | 'critical'
  minutesLateNow: number
  latePenaltyPerHourMad: number
  lateToleranceMinutes: number
  deliveryDeadlineAt: string | null
}

export interface CustomsAlertDTO {
  shipmentId: string
  requiredCount: number
  uploadedCount: number
  complianceStatus: 'missing' | 'partial'
}

export interface ActivityDTO {
  id: string
  status: string
  createdAt: string
  shipmentId: string
  reference: string
  driverName: string | null
}

export interface CommandSnapshot {
  companyId: string
  locale: string
  serverNowIso: string
  activeMissions: ActiveMissionDTO[]
  deliveredToday: DeliveredTodayDTO[]
  todayProgram: TodayProgramDTO[]
  drivers: DriverDTO[]
  workSessions: WorkSessionDTO[]
  jitAlerts: JitAlertDTO[]
  customsAlerts: CustomsAlertDTO[]
  activity: ActivityDTO[]
  lateExposureMad: number
}

interface ViewProps {
  snapshot: CommandSnapshot
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

type RelativeFormatter = ReturnType<typeof useTranslations>

function formatRelative(iso: string, nowMs: number, t: RelativeFormatter): string {
  const diffMs = nowMs - new Date(iso).getTime()
  const sec = Math.max(0, Math.round(diffMs / 1000))
  if (sec < 60) return t('relative.justNow')
  const min = Math.round(sec / 60)
  if (min < 60) return t('relative.minutesAgo', { n: min })
  const hr = Math.round(min / 60)
  if (hr < 24) return t('relative.hoursAgo', { n: hr })
  const d = Math.round(hr / 24)
  return t('relative.daysAgo', { n: d })
}

function minutesUntil(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - nowMs) / 60000)
}

export function CommandCenterView({ snapshot }: ViewProps) {
  const t = useTranslations('commandCenter')
  const router = useRouter()
  const { locale } = snapshot

  // Live ticking clock (1s) — used for relative timestamps and deadline countdowns.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-refresh toggle. When ON, we periodically refresh the SSR snapshot
  // (every 30s) AND react to realtime changes. When OFF, the user is in
  // control — useful when they're reviewing data and don't want flicker.
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshMs, setLastRefreshMs] = useState(() => Date.now())

  // Periodic refresh (debounced via interval).
  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      router.refresh()
      setLastRefreshMs(Date.now())
    }, 30_000)
    return () => window.clearInterval(id)
  }, [autoRefresh, router])

  // Realtime subscription — triggers a refresh when shipments / status / sessions change.
  // Debounced so a burst of events doesn't spam refresh().
  const refreshTimer = useRef<number | null>(null)
  const scheduleRefresh = (delay = 600) => {
    if (!autoRefresh) return
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      router.refresh()
      setLastRefreshMs(Date.now())
      refreshTimer.current = null
    }, delay)
  }

  useEffect(() => {
    if (!autoRefresh) return
    const supabase = createClient()
    const filter = `company_id=eq.${snapshot.companyId}`
    const channel = supabase
      .channel(`command-center:${snapshot.companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments', filter },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shipment_status_history', filter },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_sessions', filter },
        () => scheduleRefresh(1500),
      )
      .subscribe()

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, snapshot.companyId])

  // ── Derived state ──────────────────────────────────────────────────
  const missionsByStatus = useMemo(() => {
    const map = new Map<ActiveStatus, ActiveMissionDTO[]>()
    for (const c of KANBAN_COLUMNS) map.set(c, [])
    for (const m of snapshot.activeMissions) {
      const arr = map.get(m.status)
      if (arr) arr.push(m)
    }
    return map
  }, [snapshot.activeMissions])

  const onDutyTeam = snapshot.workSessions.filter((s) => !s.checkOutAt)
  const onDutyDriverIds = new Set(
    onDutyTeam.filter((s) => s.userRole === 'driver').map((s) => s.userId),
  )

  const totalAlerts =
    snapshot.jitAlerts.length + snapshot.customsAlerts.length

  const activeCount = snapshot.activeMissions.length
  const deliveredCount = snapshot.deliveredToday.length

  return (
    <div className="space-y-5">
      {/* ── Pulse strip: live clock, counters, refresh control ─────── */}
      <div className="rounded-xl border bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">
              {new Date(nowMs).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(nowMs).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </span>
          </div>

          <PulseCounter
            icon={Truck}
            label={t('pulse.activeMissions')}
            value={activeCount}
            tone="primary"
          />
          <PulseCounter
            icon={Users}
            label={t('pulse.onDuty')}
            value={onDutyTeam.length}
            tone="emerald"
          />
          <PulseCounter
            icon={Bell}
            label={t('pulse.alerts')}
            value={totalAlerts}
            tone={totalAlerts > 0 ? 'amber' : 'muted'}
          />
          <PulseCounter
            icon={Zap}
            label={t('pulse.delivered')}
            value={deliveredCount}
            tone="muted"
          />

          <div className="ms-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t('pulse.lastRefresh', {
                ago: formatRelative(new Date(lastRefreshMs).toISOString(), nowMs, t),
              })}
            </span>
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
                autoRefresh
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted',
              )}
              aria-pressed={autoRefresh}
            >
              {autoRefresh ? (
                <>
                  <Radio className="h-3 w-3 animate-pulse" />
                  {t('pulse.live')}
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" />
                  {t('pulse.paused')}
                </>
              )}
            </button>
            {!autoRefresh && (
              <button
                type="button"
                onClick={() => {
                  router.refresh()
                  setLastRefreshMs(Date.now())
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted focus-ring"
              >
                <Play className="h-3 w-3" />
                {t('pulse.refresh')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Critical alerts strip ─────────────────────────────────── */}
      {totalAlerts > 0 && (
        <AlertsStrip
          jit={snapshot.jitAlerts}
          customs={snapshot.customsAlerts}
          lateExposureMad={snapshot.lateExposureMad}
          locale={locale}
        />
      )}

      {/* ── Main grid: Kanban (xl: 3 cols) + Drivers panel (xl: 1 col) */}
      <div className="grid gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3 space-y-5">
          <KanbanBoard
            missionsByStatus={missionsByStatus}
            deliveredToday={snapshot.deliveredToday}
            onDutyDriverIds={onDutyDriverIds}
            locale={locale}
            nowMs={nowMs}
          />
          <DayTimeline today={snapshot.todayProgram} locale={locale} nowMs={nowMs} />
        </div>

        <div className="space-y-5">
          <DriversPanel
            drivers={snapshot.drivers}
            onDutyDriverIds={onDutyDriverIds}
            locale={locale}
          />
          <ActivityTicker activity={snapshot.activity} nowMs={nowMs} locale={locale} />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function PulseCounter({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Truck
  label: string
  value: number
  tone: 'primary' | 'emerald' | 'amber' | 'muted'
}) {
  const toneClasses: Record<typeof tone, { bg: string; text: string; iconBg: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', iconBg: 'text-primary' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-800', iconBg: 'text-amber-600' },
    muted: { bg: 'bg-muted/50', text: 'text-foreground', iconBg: 'text-muted-foreground' },
  }
  const c = toneClasses[tone]
  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.bg)}>
        <Icon className={cn('h-4 w-4', c.iconBg)} />
      </div>
      <div className="leading-tight">
        <p className={cn('text-lg font-bold tabular-nums', c.text)}>{value}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  )
}

function AlertsStrip({
  jit,
  customs,
  lateExposureMad,
  locale,
}: {
  jit: JitAlertDTO[]
  customs: CustomsAlertDTO[]
  lateExposureMad: number
  locale: string
}) {
  const t = useTranslations('commandCenter')
  const lateCount = jit.filter((j) => j.riskBand === 'late').length
  const criticalCount = jit.filter((j) => j.riskBand === 'critical').length
  const customsCount = customs.length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Bell className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm font-bold text-amber-900">
          {t('alerts.title')}
        </p>
        {lateCount > 0 && (
          <Link
            href={`/${locale}/jit`}
            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-200"
          >
            <Zap className="h-3 w-3" />
            {t('alerts.late', {
              count: lateCount,
              exposure: formatMAD(lateExposureMad),
            })}
          </Link>
        )}
        {criticalCount > 0 && (
          <Link
            href={`/${locale}/jit`}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
          >
            <AlertTriangle className="h-3 w-3" />
            {t('alerts.critical', { count: criticalCount })}
          </Link>
        )}
        {customsCount > 0 && (
          <Link
            href={`/${locale}/zones-franches`}
            className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900 ring-1 ring-orange-300 hover:bg-orange-200"
          >
            <FileWarning className="h-3 w-3" />
            {t('alerts.customs', { count: customsCount })}
          </Link>
        )}
      </div>
    </div>
  )
}

const STATUS_ACCENT: Record<ActiveStatus | 'delivered', { border: string; bg: string }> = {
  assigned: { border: 'border-blue-200', bg: 'bg-blue-50' },
  picked_up: { border: 'border-indigo-200', bg: 'bg-indigo-50' },
  in_transit: { border: 'border-amber-200', bg: 'bg-amber-50' },
  customs_clearance: { border: 'border-orange-200', bg: 'bg-orange-50' },
  delivered: { border: 'border-emerald-200', bg: 'bg-emerald-50' },
}

function KanbanBoard({
  missionsByStatus,
  deliveredToday,
  onDutyDriverIds,
  locale,
  nowMs,
}: {
  missionsByStatus: Map<ActiveStatus, ActiveMissionDTO[]>
  deliveredToday: DeliveredTodayDTO[]
  onDutyDriverIds: Set<string>
  locale: string
  nowMs: number
}) {
  const t = useTranslations('commandCenter')
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      {KANBAN_COLUMNS.map((status) => {
        const items = missionsByStatus.get(status) ?? []
        const accent = STATUS_ACCENT[status]
        return (
          <KanbanColumn
            key={status}
            title={t(`kanban.${status}`)}
            count={items.length}
            accent={accent}
            empty={t('kanban.empty')}
          >
            {items.map((m) => (
              <ActiveMissionCard
                key={m.id}
                mission={m}
                isDriverOnDuty={m.driver ? onDutyDriverIds.has(m.driver.id) : false}
                locale={locale}
                nowMs={nowMs}
              />
            ))}
          </KanbanColumn>
        )
      })}
      {/* Delivered today column */}
      <KanbanColumn
        title={t('kanban.deliveredToday')}
        count={deliveredToday.length}
        accent={STATUS_ACCENT.delivered}
        empty={t('kanban.emptyDelivered')}
      >
        {deliveredToday.map((m) => (
          <DeliveredCard key={m.id} mission={m} locale={locale} />
        ))}
      </KanbanColumn>
    </div>
  )
}

function KanbanColumn({
  title,
  count,
  accent,
  empty,
  children,
}: {
  title: string
  count: number
  accent: { border: string; bg: string }
  empty: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-[520px] flex-col rounded-xl border bg-card shadow-soft',
        accent.border,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between rounded-t-xl border-b px-3 py-2',
          accent.border,
          accent.bg,
        )}
      >
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
          {title}
        </h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-black/5">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {count === 0 ? (
          <div className="flex h-full items-center justify-center px-2 py-8 text-center text-xs text-muted-foreground">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function ActiveMissionCard({
  mission,
  isDriverOnDuty,
  locale,
  nowMs,
}: {
  mission: ActiveMissionDTO
  isDriverOnDuty: boolean
  locale: string
  nowMs: number
}) {
  const t = useTranslations('commandCenter')
  const minLeft = minutesUntil(mission.deliveryDeadlineAt, nowMs)
  const isLate = minLeft !== null && minLeft < 0
  const isCritical = minLeft !== null && minLeft >= 0 && minLeft <= 60

  return (
    <Link
      href={`/${locale}/shipments/${mission.id}`}
      className={cn(
        'block rounded-lg border bg-card p-2.5 text-xs shadow-sm transition-all hover:shadow-soft-md focus-ring',
        isLate && 'ring-1 ring-rose-300 bg-rose-50/60',
        !isLate && isCritical && 'ring-1 ring-amber-300 bg-amber-50/60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-primary">
          {mission.reference}
        </span>
        <div className="flex items-center gap-1">
          {mission.isJit && (
            <span className="inline-flex items-center rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-700">
              JIT
            </span>
          )}
          {mission.isInternational && (
            <span className="inline-flex items-center rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-bold text-indigo-700">
              INT
            </span>
          )}
        </div>
      </div>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-foreground">
        {mission.clientName ?? '—'}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {mission.pickupCity} → {mission.deliveryCity}
      </p>

      {/* Deadline countdown */}
      {mission.deliveryDeadlineAt && (
        <div
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
            isLate
              ? 'bg-rose-100 text-rose-800'
              : isCritical
                ? 'bg-amber-100 text-amber-800'
                : 'bg-muted text-foreground',
          )}
        >
          <Clock className="h-2.5 w-2.5" />
          {isLate
            ? t('deadline.late', { mins: Math.abs(minLeft) })
            : t('deadline.in', { mins: minLeft })}
        </div>
      )}

      {/* Driver row */}
      <div className="mt-2 flex items-center justify-between gap-1.5 border-t pt-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              isDriverOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300',
            )}
            aria-hidden
          />
          <span className="truncate text-[10px] text-muted-foreground">
            {mission.driver?.fullName ?? t('card.noDriver')}
            {mission.vehiclePlate ? ` · ${mission.vehiclePlate}` : ''}
          </span>
        </div>
        {mission.driver && (
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={`tel:${mission.driver.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
              aria-label={t('card.callDriver')}
              title={mission.driver.phone}
            >
              <Phone className="h-3 w-3" />
            </a>
            {mission.driver.whatsappPhone && (
              <a
                href={`https://wa.me/${mission.driver.whatsappPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                aria-label={t('card.whatsappDriver')}
              >
                <MessageCircle className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

function DeliveredCard({
  mission,
  locale,
}: {
  mission: DeliveredTodayDTO
  locale: string
}) {
  const t = useTranslations('commandCenter')
  const wasLate = (mission.latenessMinutes ?? 0) > 0
  return (
    <Link
      href={`/${locale}/shipments/${mission.id}`}
      className="block rounded-lg border bg-card p-2.5 text-xs shadow-sm transition-all hover:shadow-soft-md focus-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-emerald-700">
          {mission.reference}
        </span>
        {mission.isJit && (
          <span className="inline-flex items-center rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-700">
            JIT
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-foreground">
        {mission.clientName ?? '—'}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {mission.pickupCity} → {mission.deliveryCity}
      </p>
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">
          {formatTime(mission.deliveryActualAt, locale)}
        </span>
        {wasLate ? (
          <span className="font-semibold text-rose-700">
            {t('delivered.lateBy', { mins: mission.latenessMinutes ?? 0 })}
          </span>
        ) : (
          <span className="font-semibold text-emerald-700">{t('delivered.onTime')}</span>
        )}
      </div>
    </Link>
  )
}

function DriversPanel({
  drivers,
  onDutyDriverIds,
  locale,
}: {
  drivers: DriverDTO[]
  onDutyDriverIds: Set<string>
  locale: string
}) {
  const t = useTranslations('commandCenter')
  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t('drivers.title')}</h3>
        </div>
        <Link
          href={`/${locale}/drivers`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {t('drivers.viewAll')}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y">
        {drivers.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t('drivers.empty')}
          </li>
        ) : (
          drivers.map((d) => {
            const onDuty = onDutyDriverIds.has(d.id)
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    onDuty
                      ? 'bg-emerald-500 animate-pulse'
                      : d.isAvailable
                        ? 'bg-slate-300'
                        : 'bg-amber-400',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {d.fullName}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {d.currentMission ? (
                      <>
                        {d.currentMission.reference} → {d.currentMission.deliveryCity}
                      </>
                    ) : onDuty ? (
                      t('drivers.onDutyIdle')
                    ) : !d.isAvailable ? (
                      t('drivers.unavailable')
                    ) : (
                      t('drivers.offDuty')
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`tel:${d.phone}`}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                    aria-label={t('drivers.call')}
                    title={d.phone}
                  >
                    <Phone className="h-3 w-3" />
                  </a>
                  {d.whatsappPhone && (
                    <a
                      href={`https://wa.me/${d.whatsappPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                      aria-label={t('drivers.whatsapp')}
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function ActivityTicker({
  activity,
  nowMs,
  locale,
}: {
  activity: ActivityDTO[]
  nowMs: number
  locale: string
}) {
  const t = useTranslations('commandCenter')
  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Radio className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">{t('activity.title')}</h3>
      </div>
      <ul className="divide-y">
        {activity.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t('activity.empty')}
          </li>
        ) : (
          activity.map((a) => (
            <li key={a.id}>
              <Link
                href={`/${locale}/shipments/${a.shipmentId}`}
                className="flex items-start gap-2 px-4 py-2 transition-colors hover:bg-muted/30"
              >
                <ShipmentStatusBadge status={a.status as ShipmentStatus} size="sm" showDot={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-mono font-semibold text-primary">
                    {a.reference}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {a.driverName ?? '—'} ·{' '}
                    {formatRelative(a.createdAt, nowMs, t)}
                  </p>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function DayTimeline({
  today,
  locale,
  nowMs,
}: {
  today: TodayProgramDTO[]
  locale: string
  nowMs: number
}) {
  const t = useTranslations('commandCenter')
  // Hour bands 6 → 22 (working day window).
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)
  const dayStart = new Date()
  dayStart.setHours(6, 0, 0, 0)
  const dayEnd = new Date()
  dayEnd.setHours(23, 0, 0, 0)
  const dayMs = dayEnd.getTime() - dayStart.getTime()

  function leftPctOf(iso: string | null): number | null {
    if (!iso) return null
    const t = new Date(iso).getTime()
    if (t < dayStart.getTime() || t > dayEnd.getTime()) return null
    return ((t - dayStart.getTime()) / dayMs) * 100
  }
  const nowPct = (() => {
    const t = nowMs
    if (t < dayStart.getTime() || t > dayEnd.getTime()) return null
    return ((t - dayStart.getTime()) / dayMs) * 100
  })()

  const itemsWithPct = today
    .map((s) => ({ s, pct: leftPctOf(s.deliveryScheduledAt) }))
    .filter((x): x is { s: TodayProgramDTO; pct: number } => x.pct !== null)

  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">{t('timeline.title')}</h3>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {t('timeline.subtitle', { count: itemsWithPct.length })}
        </span>
      </div>
      <div className="px-4 py-4">
        {itemsWithPct.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t('timeline.empty')}
          </p>
        ) : (
          <div className="relative">
            {/* Hour ticks */}
            <div className="relative h-6 border-b">
              {HOURS.map((h, i) => (
                <span
                  key={h}
                  className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ insetInlineStart: `${(i / (HOURS.length - 1)) * 100}%` }}
                >
                  {h.toString().padStart(2, '0')}h
                </span>
              ))}
            </div>
            {/* Mission dots track */}
            <div className="relative mt-2 h-12">
              {/* Now marker */}
              {nowPct !== null && (
                <div
                  className="absolute top-0 h-full border-s-2 border-primary"
                  style={{ insetInlineStart: `${nowPct}%` }}
                  aria-hidden
                >
                  <span className="absolute -top-1 -translate-x-1/2 rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground rtl:translate-x-1/2">
                    {t('timeline.now')}
                  </span>
                </div>
              )}
              {/* Mission markers */}
              {itemsWithPct.map(({ s, pct }) => {
                const isPast = (() => {
                  if (!s.deliveryScheduledAt) return false
                  return new Date(s.deliveryScheduledAt).getTime() < nowMs
                })()
                const dotColor =
                  s.status === 'delivered'
                    ? 'bg-emerald-500'
                    : s.status === 'cancelled' || s.status === 'failed'
                      ? 'bg-rose-500'
                      : isPast
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                return (
                  <Link
                    key={s.id}
                    href={`/${locale}/shipments/${s.id}`}
                    className="group absolute top-3 -translate-x-1/2"
                    style={{ insetInlineStart: `${pct}%` }}
                  >
                    <span
                      className={cn(
                        'block h-3 w-3 rounded-full ring-2 ring-white transition-transform group-hover:scale-125',
                        dotColor,
                      )}
                      aria-hidden
                    />
                    <span className="invisible absolute start-1/2 top-5 z-10 w-44 -translate-x-1/2 rounded-lg border bg-popover px-2 py-1.5 text-[10px] text-popover-foreground shadow-soft-md group-hover:visible">
                      <span className="block font-mono font-bold text-primary">
                        {s.reference}
                        {s.isJit && (
                          <span className="ms-1 rounded bg-rose-100 px-1 text-[8px] text-rose-700">
                            JIT
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-medium">
                        {s.clientName ?? '—'}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {s.pickupCity} → {s.deliveryCity}
                      </span>
                      <span className="block text-muted-foreground">
                        {formatTime(s.deliveryScheduledAt, locale)}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {t('timeline.legend.scheduled')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {t('timeline.legend.past')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t('timeline.legend.delivered')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                {t('timeline.legend.failed')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
