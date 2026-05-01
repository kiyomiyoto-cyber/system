'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus, Trash2, Edit3, Loader2, X, Save, Power, PlayCircle,
  Calendar, Clock, Truck, User, Search, MapPin, ArrowRight,
  CalendarClock, Activity, CheckCircle2, PauseCircle,
  TrendingUp, Sparkles, Repeat, Building2,
} from 'lucide-react'
import {
  createRecurringSchedule,
  updateRecurringSchedule,
  deleteRecurringSchedule,
  toggleRecurringSchedule,
  runGenerationForNextWeek,
  type RecurringScheduleInput,
} from '@/actions/recurring-schedules'
import type { RecurringScheduleVehicleType } from '@/types/database.types'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { cn } from '@/lib/utils'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const VEHICLE_TYPES: RecurringScheduleVehicleType[] = ['motorcycle', 'van', 'truck', 'pickup']

export interface ClientOption { id: string; business_name: string }
export interface DriverOption { id: string; full_name: string }
export interface VehicleOption { id: string; plate_number: string }

export interface ScheduleViewModel {
  id: string
  clientId: string
  clientName: string
  name: string
  isActive: boolean
  daysOfWeek: number[]
  pickupTime: string
  deliveryOffsetMinutes: number | null
  pickupStreet: string
  pickupCity: string
  pickupPostalCode: string | null
  pickupLat: number | null
  pickupLng: number | null
  pickupContactName: string | null
  pickupContactPhone: string | null
  deliveryStreet: string
  deliveryCity: string
  deliveryPostalCode: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryContactName: string | null
  deliveryContactPhone: string | null
  defaultDriverId: string | null
  defaultVehicleId: string | null
  defaultVehicleType: RecurringScheduleVehicleType | null
  validFrom: string
  validTo: string | null
  notes: string | null
  lastGeneratedThrough: string | null
  lastGeneratedAt: string | null
  lastGeneratedCount: number | null
}

interface ViewProps {
  schedules: ScheduleViewModel[]
  clients: ClientOption[]
  drivers: DriverOption[]
  vehicles: VehicleOption[]
  canEdit: boolean
}

type FilterMode = 'all' | 'active' | 'paused'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

function daysUntilNextFriday1800(): number {
  // Next generation runs Fridays at 18:00 UTC (mirror of cron schedule)
  const now = new Date()
  const target = new Date(now)
  const dow = now.getUTCDay()
  let delta = (5 - dow + 7) % 7  // Friday = 5
  if (delta === 0 && now.getUTCHours() >= 18) delta = 7
  target.setUTCDate(now.getUTCDate() + delta)
  target.setUTCHours(18, 0, 0, 0)
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}

export function RecurringSchedulesView({
  schedules,
  clients,
  drivers,
  vehicles,
  canEdit,
}: ViewProps) {
  const t = useTranslations('recurring')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<ScheduleViewModel | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

  const activeSchedules = schedules.filter((s) => s.isActive)
  const pausedSchedules = schedules.filter((s) => !s.isActive)

  // Stats derived from data
  const weeklyMissions = activeSchedules.reduce((sum, s) => sum + s.daysOfWeek.length, 0)
  const totalGenerated = schedules.reduce((sum, s) => sum + (s.lastGeneratedCount ?? 0), 0)
  const coveredClients = new Set(activeSchedules.map((s) => s.clientId)).size
  const daysToNext = daysUntilNextFriday1800()
  const lastGenAt = schedules.reduce<string | null>((latest, s) => {
    if (!s.lastGeneratedAt) return latest
    if (!latest || s.lastGeneratedAt > latest) return s.lastGeneratedAt
    return latest
  }, null)
  const lastGenCount = schedules.reduce((sum, s) => sum + (s.lastGeneratedCount ?? 0), 0)

  // Filtering
  const filtered = schedules
    .filter((s) => {
      if (filter === 'active') return s.isActive
      if (filter === 'paused') return !s.isActive
      return true
    })
    .filter((s) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.clientName.toLowerCase().includes(q) ||
        s.pickupCity.toLowerCase().includes(q) ||
        s.deliveryCity.toLowerCase().includes(q)
      )
    })

  function handleToggle(s: ScheduleViewModel) {
    startTransition(async () => {
      const result = await toggleRecurringSchedule(s.id, !s.isActive)
      if (result.error) toast.error(result.error)
      else {
        toast.success(s.isActive ? t('toast.deactivated') : t('toast.activated'))
        router.refresh()
      }
    })
  }

  function handleDelete(s: ScheduleViewModel) {
    if (!confirm(t('confirmDelete', { name: s.name }))) return
    startTransition(async () => {
      const result = await deleteRecurringSchedule(s.id)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('toast.deleted'))
        router.refresh()
      }
    })
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await runGenerationForNextWeek()
      if (result.error) {
        toast.error(result.error)
        return
      }
      const inserted = result.data?.inserted ?? 0
      toast.success(t('toast.generated', { count: inserted }))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                activeSchedules.length > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  activeSchedules.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
                )}
              />
              {activeSchedules.length > 0
                ? t('page.automationActive')
                : t('page.automationPaused')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {t('page.cronInfo')}
            </span>
          </div>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.active')}
            value={`${activeSchedules.length}`}
            subtitle={t('stats.activeOf', { total: schedules.length })}
            icon={Repeat}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.weeklyMissions')}
            value={weeklyMissions}
            subtitle={t('stats.weeklyMissionsSubtitle', { shipments: weeklyMissions })}
            icon={Activity}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.nextGeneration')}
            value={t('stats.nextGenerationDays', { days: daysToNext })}
            subtitle={t('page.cronInfo')}
            icon={Sparkles}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.lastGeneration')}
            value={
              lastGenAt
                ? new Date(lastGenAt).toLocaleDateString('fr-MA', {
                    day: '2-digit', month: 'short',
                  })
                : t('stats.lastGenerationNever')
            }
            subtitle={t('stats.lastGenerationCount', { count: lastGenCount })}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Next-week preview */}
      <NextWeekPreview schedules={activeSchedules} />

      {/* Toolbar */}
      <FadeIn delay={0.18}>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('filter.search')}
                  className="h-9 w-64 rounded-lg border bg-background ps-8 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex rounded-lg border bg-background p-0.5">
                {(['all', 'active', 'paused'] as FilterMode[]).map((m) => {
                  const count =
                    m === 'all' ? schedules.length :
                    m === 'active' ? activeSchedules.length : pausedSchedules.length
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFilter(m)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition',
                        filter === m
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(`filter.${m}`)}
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        filter === m ? 'bg-white/20' : 'bg-muted',
                      )}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending || activeSchedules.length === 0}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  {t('list.generateNow')}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
                >
                  <Plus className="h-4 w-4" />
                  {t('list.newSchedule')}
                </button>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Empty state */}
      {schedules.length === 0 ? (
        <FadeIn delay={0.22}>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-12 text-center shadow-soft">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('list.empty')}</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              {t('list.emptyHint')}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
              >
                <Plus className="h-4 w-4" />
                {t('list.emptyAction')}
              </button>
            )}
          </div>
        </FadeIn>
      ) : filtered.length === 0 ? (
        <FadeIn delay={0.22}>
          <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('list.noResults')}</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" delayChildren={0.22}>
          {filtered.map((s) => (
            <StaggerItem key={s.id}>
              <ScheduleCard
                schedule={s}
                drivers={drivers}
                vehicles={vehicles}
                canEdit={canEdit}
                isPending={isPending}
                onToggle={() => handleToggle(s)}
                onEdit={() => setEditing(s)}
                onDelete={() => handleDelete(s)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {(creating || editing) && (
        <ScheduleDialog
          schedule={editing}
          clients={clients}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// ScheduleCard — premium redesign
// ============================================================
interface ScheduleCardProps {
  schedule: ScheduleViewModel
  drivers: DriverOption[]
  vehicles: VehicleOption[]
  canEdit: boolean
  isPending: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function ScheduleCard({
  schedule: s, drivers, vehicles, canEdit, isPending, onToggle, onEdit, onDelete,
}: ScheduleCardProps) {
  const t = useTranslations('recurring')
  const driverName = s.defaultDriverId
    ? drivers.find((d) => d.id === s.defaultDriverId)?.full_name
    : null
  const vehiclePlate = s.defaultVehicleId
    ? vehicles.find((v) => v.id === s.defaultVehicleId)?.plate_number
    : null

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-md',
        !s.isActive && 'opacity-75',
      )}
    >
      {/* Status stripe */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-0 start-0 w-1',
          s.isActive
            ? 'bg-gradient-to-b from-primary via-primary to-primary/40'
            : 'bg-muted-foreground/30',
        )}
      />

      {/* Top: status + actions */}
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4 ps-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                s.isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {s.isActive ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <PauseCircle className="h-2.5 w-2.5" />
              )}
              {s.isActive ? t('card.active') : t('card.paused')}
            </span>
            <span className="text-[11px] text-muted-foreground">
              · {t('list.schedulesPerWeek', { count: s.daysOfWeek.length })}
            </span>
          </div>
          <h3 className="truncate font-semibold text-foreground">{s.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {s.clientName}
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-60 sm:group-hover:opacity-100">
            <button
              type="button"
              onClick={onToggle}
              disabled={isPending}
              className={cn(
                'rounded-lg border p-1.5 text-xs transition-colors disabled:opacity-50',
                s.isActive
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              )}
              title={s.isActive ? t('actions.pause') : t('actions.resume')}
              aria-label={s.isActive ? t('actions.pause') : t('actions.resume')}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t('actions.edit')}
              aria-label={t('actions.edit')}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
              title={t('actions.delete')}
              aria-label={t('actions.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3.5 px-5 py-4 ps-6">
        {/* Day chips */}
        <div className="flex flex-wrap gap-1">
          {DAY_KEYS.map((dk, idx) => {
            const dayNum = idx + 1
            const on = s.daysOfWeek.includes(dayNum)
            return (
              <span
                key={dk}
                className={cn(
                  'inline-flex h-7 w-9 items-center justify-center rounded-md text-[11px] font-bold uppercase tabular-nums transition-colors',
                  on
                    ? s.isActive
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                      : 'bg-muted text-foreground/80'
                    : 'bg-muted/40 text-muted-foreground/40',
                )}
              >
                {t(`day.${dk}`).slice(0, 3)}
              </span>
            )
          })}
        </div>

        {/* Time + offset */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-semibold tabular-nums">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {s.pickupTime}
          </span>
          <span className="text-xs text-muted-foreground">
            {s.deliveryOffsetMinutes != null && s.deliveryOffsetMinutes > 0
              ? t('card.deliveryIn', {
                  hours: Math.round((s.deliveryOffsetMinutes / 60) * 10) / 10,
                })
              : t('card.noDeliveryTime')}
          </span>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {s.pickupCity}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {s.deliveryCity}
          </span>
        </div>

        {/* Resources (driver / vehicle) */}
        {(driverName || vehiclePlate || s.defaultVehicleType) && (
          <div className="flex flex-wrap gap-1.5">
            {driverName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                  {getInitials(driverName)}
                </span>
                <span className="text-foreground">{driverName}</span>
              </span>
            )}
            {vehiclePlate && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-foreground">
                <Truck className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{vehiclePlate}</span>
              </span>
            )}
            {s.defaultVehicleType && !vehiclePlate && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                <Truck className="h-3 w-3" />
                {t(`vehicleType.${s.defaultVehicleType}`)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/20 px-5 py-2.5 ps-6">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {s.lastGeneratedAt && s.lastGeneratedThrough
              ? t('list.lastGenerated', {
                  date: s.lastGeneratedThrough,
                  count: s.lastGeneratedCount ?? 0,
                })
              : t('list.neverGenerated')}
          </span>
          <span className="shrink-0">
            {s.validTo
              ? t('list.validUntil', { date: s.validTo })
              : t('list.validForever')}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// NextWeekPreview — polished weekly timeline
// ============================================================
function NextWeekPreview({ schedules }: { schedules: ScheduleViewModel[] }) {
  const t = useTranslations('recurring')

  const window = useMemo(() => {
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    const start = new Date(d)
    start.setUTCDate(start.getUTCDate() + (8 - dow))
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start)
      day.setUTCDate(start.getUTCDate() + i)
      return day
    })
  }, [])

  const cellsByDay = window.map((day) => {
    const isoDow = ((day.getUTCDay() + 6) % 7) + 1 // Mon=1..Sun=7
    const matches = schedules
      .filter((s) => {
        if (!s.daysOfWeek.includes(isoDow)) return false
        const dayIso = day.toISOString().slice(0, 10)
        if (dayIso < s.validFrom) return false
        if (s.validTo && dayIso > s.validTo) return false
        return true
      })
      .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime))
    return { day, isoDow, matches }
  })

  const totalMissions = cellsByDay.reduce((sum, c) => sum + c.matches.length, 0)
  const peakDay = Math.max(1, ...cellsByDay.map((c) => c.matches.length))

  const startStr = window[0]?.toISOString().slice(0, 10) ?? ''
  const endStr = window[6]?.toISOString().slice(0, 10) ?? ''

  return (
    <FadeIn delay={0.14}>
      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {t('preview.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('preview.subtitle', {
                start: startStr,
                end: endStr,
                count: totalMissions,
              })}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Activity className="h-3.5 w-3.5" />
            {t('preview.totalDay', { count: totalMissions })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {cellsByDay.map(({ day, isoDow, matches }) => {
            const dayKey = DAY_KEYS[isoDow - 1]
            const intensity = matches.length / peakDay
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'group relative flex flex-col rounded-xl border bg-background p-3 transition-all hover:border-primary/40 hover:shadow-soft',
                  matches.length === 0 && 'opacity-60',
                )}
              >
                {/* Day intensity gauge */}
                <div className="absolute inset-x-3 top-0 h-0.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      matches.length > 0 ? 'bg-primary' : 'bg-muted',
                    )}
                    style={{ width: `${Math.max(8, intensity * 100)}%` }}
                  />
                </div>

                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-bold text-foreground">
                    {dayKey ? t(`day.${dayKey}`) : ''}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {String(day.getUTCDate()).padStart(2, '0')}/
                    {String(day.getUTCMonth() + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  <span
                    className={cn(
                      'text-2xl font-bold tabular-nums leading-none',
                      matches.length === 0 && 'text-muted-foreground/40',
                    )}
                  >
                    {matches.length}
                  </span>
                  {matches.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {t('card.perWeek')}
                    </span>
                  )}
                </div>

                {matches.length === 0 ? (
                  <p className="mt-1 text-[11px] italic text-muted-foreground/50">
                    {t('preview.noMission')}
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {matches.slice(0, 3).map((m) => (
                      <li
                        key={m.id}
                        className="rounded-md bg-primary/5 px-1.5 py-1 text-[10px] leading-tight transition-colors hover:bg-primary/10"
                      >
                        <span className="font-mono font-bold text-primary">{m.pickupTime}</span>
                        <span className="ms-1 truncate text-foreground">{m.clientName}</span>
                        <span className="block truncate text-muted-foreground">
                          {m.pickupCity} → {m.deliveryCity}
                        </span>
                      </li>
                    ))}
                    {matches.length > 3 && (
                      <li className="px-1.5 text-[10px] font-medium text-muted-foreground">
                        {t('preview.moreCount', { count: matches.length - 3 })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </FadeIn>
  )
}

// ============================================================
// ScheduleDialog
// ============================================================
interface DialogProps {
  schedule: ScheduleViewModel | null
  clients: ClientOption[]
  drivers: DriverOption[]
  vehicles: VehicleOption[]
  onClose: () => void
  onSaved: () => void
}

function ScheduleDialog({ schedule, clients, drivers, vehicles, onClose, onSaved }: DialogProps) {
  const t = useTranslations('recurring')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const todayIso = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId] = useState(schedule?.clientId ?? clients[0]?.id ?? '')
  const [name, setName] = useState(schedule?.name ?? '')
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(schedule?.daysOfWeek ?? [1, 3, 5])
  const [pickupTime, setPickupTime] = useState(schedule?.pickupTime ?? '06:00')
  const [deliveryOffsetH, setDeliveryOffsetH] = useState(
    schedule?.deliveryOffsetMinutes !== null && schedule?.deliveryOffsetMinutes !== undefined
      ? String(schedule.deliveryOffsetMinutes / 60)
      : '',
  )

  const [pickupStreet, setPickupStreet] = useState(schedule?.pickupStreet ?? '')
  const [pickupCity, setPickupCity] = useState(schedule?.pickupCity ?? '')
  const [pickupContactName, setPickupContactName] = useState(schedule?.pickupContactName ?? '')
  const [pickupContactPhone, setPickupContactPhone] = useState(schedule?.pickupContactPhone ?? '')

  const [deliveryStreet, setDeliveryStreet] = useState(schedule?.deliveryStreet ?? '')
  const [deliveryCity, setDeliveryCity] = useState(schedule?.deliveryCity ?? '')
  const [deliveryContactName, setDeliveryContactName] = useState(schedule?.deliveryContactName ?? '')
  const [deliveryContactPhone, setDeliveryContactPhone] = useState(schedule?.deliveryContactPhone ?? '')

  const [defaultDriverId, setDefaultDriverId] = useState(schedule?.defaultDriverId ?? '')
  const [defaultVehicleId, setDefaultVehicleId] = useState(schedule?.defaultVehicleId ?? '')
  const [defaultVehicleType, setDefaultVehicleType] = useState<string>(schedule?.defaultVehicleType ?? '')

  const [validFrom, setValidFrom] = useState(schedule?.validFrom ?? todayIso)
  const [validTo, setValidTo] = useState(schedule?.validTo ?? '')
  const [notes, setNotes] = useState(schedule?.notes ?? '')

  function toggleDay(dayNum: number) {
    setDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort((a, b) => a - b),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) {
      toast.error(t('dialog.clientRequired'))
      return
    }
    if (!name.trim()) {
      toast.error(t('dialog.nameRequired'))
      return
    }
    if (daysOfWeek.length === 0) {
      toast.error(t('dialog.daysRequired'))
      return
    }

    const offsetMinutes = deliveryOffsetH.trim() === '' ? null : Math.round(Number(deliveryOffsetH) * 60)
    if (offsetMinutes !== null && (Number.isNaN(offsetMinutes) || offsetMinutes < 0 || offsetMinutes > 24 * 60)) {
      toast.error(t('dialog.offsetInvalid'))
      return
    }

    const payload: RecurringScheduleInput = {
      clientId,
      name: name.trim(),
      isActive,
      daysOfWeek,
      pickupTime,
      deliveryOffsetMinutes: offsetMinutes,
      pickupStreet: pickupStreet.trim(),
      pickupCity: pickupCity.trim(),
      pickupPostalCode: null,
      pickupLat: null,
      pickupLng: null,
      pickupContactName: pickupContactName.trim() || null,
      pickupContactPhone: pickupContactPhone.trim() || null,
      deliveryStreet: deliveryStreet.trim(),
      deliveryCity: deliveryCity.trim(),
      deliveryPostalCode: null,
      deliveryLat: null,
      deliveryLng: null,
      deliveryContactName: deliveryContactName.trim() || null,
      deliveryContactPhone: deliveryContactPhone.trim() || null,
      defaultDriverId: defaultDriverId || null,
      defaultVehicleId: defaultVehicleId || null,
      defaultVehicleType: defaultVehicleType === '' ? null : (defaultVehicleType as RecurringScheduleVehicleType),
      validFrom,
      validTo: validTo || null,
      notes: notes.trim() || null,
    }
    startTransition(async () => {
      const result = schedule
        ? await updateRecurringSchedule(schedule.id, payload)
        : await createRecurringSchedule(payload)
      if (result.error) toast.error(result.error)
      else {
        toast.success(schedule ? t('toast.updated') : t('toast.created'))
        onSaved()
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {schedule ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <h3 className="font-semibold text-foreground">
              {schedule ? t('dialog.editTitle') : t('dialog.newTitle')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.client')} *</label>
              <select
                className={inputClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.name')} *</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('dialog.namePlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.days')} *</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_KEYS.map((dk, idx) => {
                const dayNum = idx + 1
                const on = daysOfWeek.includes(dayNum)
                return (
                  <button
                    key={dk}
                    type="button"
                    onClick={() => toggleDay(dayNum)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                      on
                        ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                        : 'bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {t(`day.${dk}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.pickupTime')} *</label>
              <input className={inputClass} type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.deliveryOffset')}</label>
              <input
                className={inputClass}
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={deliveryOffsetH}
                onChange={(e) => setDeliveryOffsetH(e.target.value)}
                placeholder="2.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{t('dialog.deliveryOffsetHint')}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.vehicleType')}</label>
              <select
                className={inputClass}
                value={defaultVehicleType}
                onChange={(e) => setDefaultVehicleType(e.target.value)}
              >
                <option value="">—</option>
                {VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>{t(`vehicleType.${vt}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dialog.pickup')}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.address')} *</label>
                <input className={inputClass} value={pickupStreet} onChange={(e) => setPickupStreet(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.city')} *</label>
                <input className={inputClass} value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} placeholder="Tanger" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.contactName')}</label>
                <input className={inputClass} value={pickupContactName} onChange={(e) => setPickupContactName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.contactPhone')}</label>
                <input className={inputClass} value={pickupContactPhone} onChange={(e) => setPickupContactPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dialog.delivery')}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.address')} *</label>
                <input className={inputClass} value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.city')} *</label>
                <input className={inputClass} value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="Kénitra" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.contactName')}</label>
                <input className={inputClass} value={deliveryContactName} onChange={(e) => setDeliveryContactName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.contactPhone')}</label>
                <input className={inputClass} value={deliveryContactPhone} onChange={(e) => setDeliveryContactPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.driver')}</label>
              <select className={inputClass} value={defaultDriverId} onChange={(e) => setDefaultDriverId(e.target.value)}>
                <option value="">{t('dialog.driverNone')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('dialog.driverHint')}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.vehicle')}</label>
              <select className={inputClass} value={defaultVehicleId} onChange={(e) => setDefaultVehicleId(e.target.value)}>
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate_number}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.validFrom')} *</label>
              <input className={inputClass} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.validTo')}</label>
              <input className={inputClass} type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">{t('dialog.validToHint')}</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('dialog.notes')}</label>
            <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t('dialog.isActive')}</span>
          </label>
        </div>

        <div className="flex shrink-0 gap-2 border-t bg-card p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-soft-md disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
