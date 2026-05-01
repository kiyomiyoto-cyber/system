'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Clock,
  Zap,
  TrendingDown,
  CheckCircle2,
  Save,
  Edit3,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { setClientJitPolicy, type JitPolicyInput } from '@/actions/jit'

export type RiskBand = 'late' | 'critical' | 'warning' | 'on_track' | 'no_deadline'

export interface AtRiskRow {
  id: string
  reference: string
  clientId: string
  clientName: string
  status: string
  pickupCity: string
  deliveryCity: string
  deliveryScheduledAt: string | null
  deliveryDeadlineAt: string | null
  latePenaltyPerHourMad: number
  lateToleranceMinutes: number
  riskBand: RiskBand
  minutesLateNow: number
}

export interface RecentLateRow {
  id: string
  reference: string
  clientName: string
  deliveryActualAt: string | null
  deliveryDeadlineAt: string | null
  latenessMinutes: number | null
  latePenaltyMad: number
}

export interface ClientPolicyRow {
  id: string
  businessName: string
  isActive: boolean
  deliveryWindowStrict: boolean
  latePenaltyPerHourMad: number
  lateToleranceMinutes: number
}

interface ViewProps {
  atRisk: AtRiskRow[]
  recent: RecentLateRow[]
  clients: ClientPolicyRow[]
  canEdit: boolean
  totalExposureNow: number
  last30dPenalty: number
}

type TabKey = 'atRisk' | 'recent' | 'clients'

const SHIPMENT_STATUS_LABEL = {
  created: 'shipmentStatus.created',
  assigned: 'shipmentStatus.assigned',
  picked_up: 'shipmentStatus.picked_up',
  in_transit: 'shipmentStatus.in_transit',
  customs_clearance: 'shipmentStatus.customs_clearance',
  delivered: 'shipmentStatus.delivered',
  failed: 'shipmentStatus.failed',
  cancelled: 'shipmentStatus.cancelled',
} as const

const RISK_COLORS: Record<RiskBand, { ring: string; bg: string; text: string; dot: string }> = {
  late: {
    ring: 'ring-rose-300',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
  },
  critical: {
    ring: 'ring-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  warning: {
    ring: 'ring-yellow-200',
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
  },
  on_track: {
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  no_deadline: {
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
  },
}

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDateTime(d: string | null, locale: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Compact "in 2h 15m" / "30m late" style countdown built off the
 * deadline timestamp. Re-renders every minute via the parent's
 * 60-second tick.
 */
function formatCountdown(deadline: string | null, now: number, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (!deadline) return t('countdown.none')
  const diff = new Date(deadline).getTime() - now
  const absMinutes = Math.floor(Math.abs(diff) / 60000)
  const h = Math.floor(absMinutes / 60)
  const m = absMinutes % 60
  const parts = h > 0 ? `${h}h ${m.toString().padStart(2, '0')}` : `${m}m`
  return diff < 0 ? t('countdown.late', { delta: parts }) : t('countdown.in', { delta: parts })
}

function billablePenalty(row: AtRiskRow, now: number): number {
  if (row.riskBand !== 'late') return 0
  const minutesLate =
    row.deliveryDeadlineAt == null
      ? 0
      : Math.max(0, Math.ceil((now - new Date(row.deliveryDeadlineAt).getTime()) / 60000))
  const billable = Math.max(0, minutesLate - row.lateToleranceMinutes)
  if (billable === 0) return 0
  return Math.ceil(billable / 60) * row.latePenaltyPerHourMad
}

export function JitView({
  atRisk,
  recent,
  clients,
  canEdit,
  totalExposureNow,
  last30dPenalty,
}: ViewProps) {
  const t = useTranslations('jit')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<TabKey>('atRisk')
  const [editingClient, setEditingClient] = useState<ClientPolicyRow | null>(null)
  const [now, setNow] = useState<number>(Date.now())

  // Tick once a minute so deadlines/countdowns stay accurate without
  // forcing a server round-trip.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const counters = useMemo(() => {
    const c = { late: 0, critical: 0, warning: 0, onTrack: 0 }
    for (const r of atRisk) {
      if (r.riskBand === 'late') c.late += 1
      else if (r.riskBand === 'critical') c.critical += 1
      else if (r.riskBand === 'warning') c.warning += 1
      else if (r.riskBand === 'on_track') c.onTrack += 1
    }
    return c
  }, [atRisk])

  const liveExposure = useMemo(
    () => atRisk.reduce((sum, r) => sum + billablePenalty(r, now), 0),
    [atRisk, now],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('stats.lateNow')}
          value={`${counters.late}`}
          subtitle={t('stats.lateNowSubtitle')}
          icon={AlertTriangle}
          tone={counters.late > 0 ? 'rose' : 'emerald'}
        />
        <KpiCard
          label={t('stats.critical')}
          value={`${counters.critical + counters.warning}`}
          subtitle={t('stats.criticalSubtitle')}
          icon={Clock}
          tone={counters.critical > 0 ? 'amber' : 'slate'}
        />
        <KpiCard
          label={t('stats.exposureNow')}
          value={formatCurrency(liveExposure, locale)}
          subtitle={
            liveExposure > 0
              ? t('stats.exposureNowSubtitle')
              : t('stats.exposureNowEmpty')
          }
          icon={TrendingDown}
          tone={liveExposure > 0 ? 'rose' : 'emerald'}
        />
        <KpiCard
          label={t('stats.last30d')}
          value={formatCurrency(last30dPenalty, locale)}
          subtitle={t('stats.last30dSubtitle')}
          icon={Zap}
          tone={last30dPenalty > 0 ? 'amber' : 'slate'}
        />
      </div>

      {counters.late > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-soft">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">
                {t('banner.title', { count: counters.late })}
              </p>
              <p className="mt-1 text-xs">{t('banner.subtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border bg-background p-0.5">
            {(['atRisk', 'recent', 'clients'] as TabKey[]).map((k) => {
              const count =
                k === 'atRisk' ? atRisk.length : k === 'recent' ? recent.length : clients.length
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
                    tab === k
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`tabs.${k}`)}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                      tab === k ? 'bg-white/20' : 'bg-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          {tab === 'atRisk' && (
            <span className="text-xs text-muted-foreground">
              {t('refreshInfo')}
            </span>
          )}
          {tab === 'recent' && totalExposureNow > 0 && (
            <span className="text-xs text-muted-foreground">
              {t('exposureSnapshot', { value: formatCurrency(totalExposureNow, locale) })}
            </span>
          )}
        </div>
      </div>

      {tab === 'atRisk' && (
        <AtRiskTable
          rows={atRisk}
          now={now}
        />
      )}
      {tab === 'recent' && <RecentTable rows={recent} />}
      {tab === 'clients' && (
        <ClientsTable
          rows={clients}
          canEdit={canEdit}
          onEdit={(c) => setEditingClient(c)}
        />
      )}

      {editingClient && (
        <ClientPolicyDialog
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSubmit={(data) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await setClientJitPolicy(data)
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(t('toast.clientUpdated'))
                router.refresh()
                resolve(true)
              })
            })
          }
          isPending={isPending}
        />
      )}
    </div>
  )
}

// ============================================================
function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'rose' | 'amber' | 'emerald' | 'slate'
}) {
  const map = {
    rose: { iconColor: 'text-rose-600', iconBg: 'bg-rose-100' },
    amber: { iconColor: 'text-amber-600', iconBg: 'bg-amber-100' },
    emerald: { iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
    slate: { iconColor: 'text-slate-600', iconBg: 'bg-slate-100' },
  } as const
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', map[tone].iconBg)}>
          <Icon className={cn('h-4 w-4', map[tone].iconColor)} />
        </div>
      </div>
    </div>
  )
}

// ============================================================
function AtRiskTable({ rows, now }: { rows: AtRiskRow[]; now: number }) {
  const t = useTranslations('jit')
  const locale = useLocale()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
        <p className="text-sm font-medium text-foreground">{t('empty.atRiskTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('empty.atRiskSubtitle')}</p>
      </div>
    )
  }

  // Order: late → critical → warning → on_track
  const bandOrder: Record<RiskBand, number> = {
    late: 0,
    critical: 1,
    warning: 2,
    on_track: 3,
    no_deadline: 4,
  }
  const sorted = [...rows].sort((a, b) => bandOrder[a.riskBand] - bandOrder[b.riskBand])

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('table.shipment')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.client')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.deadline')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.countdown')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.exposure')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => {
              const colors = RISK_COLORS[r.riskBand]
              const exposure = billablePenalty(r, now)
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold">{r.reference}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.pickupCity} → {r.deliveryCity}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{r.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('table.penaltyRate', {
                        amount: formatCurrency(r.latePenaltyPerHourMad, locale),
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {formatDateTime(r.deliveryDeadlineAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                        colors.ring,
                        colors.bg,
                        colors.text,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                      {formatCountdown(r.deliveryDeadlineAt, now, t as never)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums">
                    {exposure > 0 ? (
                      <span className="font-semibold text-rose-700">
                        {formatCurrency(exposure, locale)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {SHIPMENT_STATUS_LABEL[r.status as keyof typeof SHIPMENT_STATUS_LABEL]
                        ? t(SHIPMENT_STATUS_LABEL[r.status as keyof typeof SHIPMENT_STATUS_LABEL])
                        : r.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
function RecentTable({ rows }: { rows: RecentLateRow[] }) {
  const t = useTranslations('jit')
  const locale = useLocale()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
        <p className="text-sm text-muted-foreground">{t('empty.recent')}</p>
      </div>
    )
  }

  const totalPenalty = rows.reduce((s, r) => s + r.latePenaltyMad, 0)

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('table.shipment')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.client')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.deadline')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.actual')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.lateness')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.penalty')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-semibold">{r.reference}</p>
                </td>
                <td className="px-4 py-3 text-sm">{r.clientName}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatDateTime(r.deliveryDeadlineAt, locale)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatDateTime(r.deliveryActualAt, locale)}
                </td>
                <td className="px-4 py-3 text-end text-xs">
                  {r.latenessMinutes == null
                    ? '—'
                    : r.latenessMinutes <= 0
                      ? t('table.onTime')
                      : t('table.minutesLate', { count: r.latenessMinutes })}
                </td>
                <td className="px-4 py-3 text-end font-mono tabular-nums">
                  {r.latePenaltyMad > 0 ? (
                    <span className="font-semibold text-rose-700">
                      {formatCurrency(r.latePenaltyMad, locale)}
                    </span>
                  ) : (
                    <span className="text-emerald-700">—</span>
                  )}
                </td>
              </tr>
            ))}
            {totalPenalty > 0 && (
              <tr className="border-t bg-muted/40">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={5}>
                  {t('table.totalPenalty30d')}
                </td>
                <td className="px-4 py-3 text-end font-mono font-bold text-rose-700">
                  {formatCurrency(totalPenalty, locale)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
function ClientsTable({
  rows,
  canEdit,
  onEdit,
}: {
  rows: ClientPolicyRow[]
  canEdit: boolean
  onEdit: (c: ClientPolicyRow) => void
}) {
  const t = useTranslations('jit')
  const locale = useLocale()

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('table.client')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.policy')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.penaltyPerHour')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.tolerance')}</th>
              <th className="px-4 py-3 text-end font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => (
              <tr key={c.id} className={cn('hover:bg-muted/30', !c.isActive && 'opacity-60')}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{c.businessName}</p>
                </td>
                <td className="px-4 py-3">
                  {c.deliveryWindowStrict ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-rose-200">
                      <Zap className="h-3 w-3" />
                      {t('table.strict')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {t('table.flexible')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end font-mono tabular-nums">
                  {c.deliveryWindowStrict
                    ? formatCurrency(c.latePenaltyPerHourMad, locale)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-end text-xs">
                  {c.deliveryWindowStrict
                    ? t('table.minutesGrace', { count: c.lateToleranceMinutes })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-end">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {t('actions.editPolicy')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
function ClientPolicyDialog({
  client,
  onClose,
  onSubmit,
  isPending,
}: {
  client: ClientPolicyRow
  onClose: () => void
  onSubmit: (data: JitPolicyInput) => Promise<boolean>
  isPending: boolean
}) {
  const t = useTranslations('jit')
  const [strict, setStrict] = useState<boolean>(client.deliveryWindowStrict)
  const [penalty, setPenalty] = useState<number>(client.latePenaltyPerHourMad)
  const [tolerance, setTolerance] = useState<number>(client.lateToleranceMinutes)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const ok = await onSubmit({
      clientId: client.id,
      deliveryWindowStrict: strict,
      latePenaltyPerHourMad: penalty,
      lateToleranceMinutes: tolerance,
    })
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-6 shadow-soft-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{t('dialog.title')}</h2>
            <p className="text-xs text-muted-foreground">{client.businessName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
              className="mt-0.5 rounded border-muted-foreground/30"
            />
            <div>
              <p className="font-semibold">{t('dialog.strict')}</p>
              <p className="text-xs text-muted-foreground">{t('dialog.strictHint')}</p>
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">
                {t('dialog.penaltyPerHour')}
              </span>
              <input
                type="number"
                min="0"
                step="100"
                disabled={!strict}
                value={penalty}
                onChange={(e) => setPenalty(Number(e.target.value))}
                className="w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">
                {t('dialog.tolerance')}
              </span>
              <input
                type="number"
                min="0"
                max="720"
                step="5"
                disabled={!strict}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {t('dialog.snapshotNote')}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
