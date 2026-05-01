'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  ScrollText,
  Users,
  CalendarDays,
  Activity,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  Send,
  Archive,
  Trash2,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AuditEntry {
  id: string
  companyId: string
  entityType: string
  entityId: string
  action: string
  notes: string | null
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  actorUserId: string | null
  actorRole: string | null
  actorName: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface FilterOption {
  value: string
  label: string
}

interface ViewProps {
  entries: AuditEntry[]
  entityOptions: FilterOption[]
  actionOptions: FilterOption[]
  actorOptions: FilterOption[]
  kpis: {
    last7d: number
    today: number
    externalAccountantActions: number
    distinctActors: number
  }
  showCompanyColumn: boolean
  initialFilters: {
    entity: string
    action: string
    actor: string
    from: string
    to: string
  }
}

const ACTION_ICON: Record<string, LucideIcon> = {
  create: Plus,
  update: Edit3,
  validate: CheckCircle2,
  reject: XCircle,
  complete: CheckCircle2,
  send: Send,
  archive: Archive,
  delete: Trash2,
}

const ACTION_COLOR: Record<string, { bg: string; text: string }> = {
  create: { bg: 'bg-blue-50', text: 'text-blue-700' },
  update: { bg: 'bg-violet-50', text: 'text-violet-700' },
  validate: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  reject: { bg: 'bg-rose-50', text: 'text-rose-700' },
  complete: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  send: { bg: 'bg-amber-50', text: 'text-amber-700' },
  archive: { bg: 'bg-slate-50', text: 'text-slate-700' },
  delete: { bg: 'bg-rose-50', text: 'text-rose-700' },
}

function formatDateTime(d: string, locale: string): string {
  return new Date(d).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Compute the field-by-field diff between before and after for the timeline
 * details. Skips identical values, deeply-nested objects (rendered as JSON),
 * and a few noisy fields.
 */
function diffStates(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ key: string; before: unknown; after: unknown }> {
  const keys = new Set<string>()
  if (before) for (const k of Object.keys(before)) keys.add(k)
  if (after) for (const k of Object.keys(after)) keys.add(k)
  const skip = new Set(['updated_at', 'created_at'])
  const out: Array<{ key: string; before: unknown; after: unknown }> = []
  for (const k of keys) {
    if (skip.has(k)) continue
    const b = before?.[k]
    const a = after?.[k]
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    out.push({ key: k, before: b, after: a })
  }
  return out
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  return String(v)
}

export function ActiviteView({
  entries,
  entityOptions,
  actionOptions,
  actorOptions,
  kpis,
  showCompanyColumn,
  initialFilters,
}: ViewProps) {
  const t = useTranslations('audit')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [filters, setFilters] = useState(initialFilters)
  const [expanded, setExpanded] = useState<string | null>(null)

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters],
  )

  function applyFilters() {
    const params = new URLSearchParams()
    if (filters.entity) params.set('entity', filters.entity)
    if (filters.action) params.set('action', filters.action)
    if (filters.actor) params.set('actor', filters.actor)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function resetFilters() {
    setFilters({ entity: '', action: '', actor: '', from: '', to: '' })
    router.push(pathname)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('stats.today')}
          value={`${kpis.today}`}
          icon={CalendarDays}
          tone="blue"
        />
        <KpiCard
          label={t('stats.last7d')}
          value={`${kpis.last7d}`}
          icon={Activity}
          tone="indigo"
        />
        <KpiCard
          label={t('stats.distinctActors')}
          value={`${kpis.distinctActors}`}
          icon={Users}
          tone="emerald"
        />
        <KpiCard
          label={t('stats.externalAccountant')}
          value={`${kpis.externalAccountantActions}`}
          icon={ScrollText}
          tone={kpis.externalAccountantActions > 0 ? 'violet' : 'slate'}
        />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 pb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('filters.title')}</h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ms-auto inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-muted"
            >
              <X className="h-3 w-3" />
              {t('filters.reset')}
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect
            label={t('filters.entity')}
            value={filters.entity}
            options={entityOptions}
            onChange={(v) => setFilters({ ...filters, entity: v })}
          />
          <FilterSelect
            label={t('filters.action')}
            value={filters.action}
            options={actionOptions}
            onChange={(v) => setFilters({ ...filters, action: v })}
          />
          <FilterSelect
            label={t('filters.actor')}
            value={filters.actor}
            options={actorOptions}
            onChange={(v) => setFilters({ ...filters, actor: v })}
          />
          <FilterDate
            label={t('filters.from')}
            value={filters.from}
            onChange={(v) => setFilters({ ...filters, from: v })}
          />
          <FilterDate
            label={t('filters.to')}
            value={filters.to}
            onChange={(v) => setFilters({ ...filters, to: v })}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Filter className="h-3.5 w-3.5" />
            {t('filters.apply')}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
          <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t('empty.title')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilters ? t('empty.filtered') : t('empty.subtitle')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <ul className="divide-y">
            {entries.map((e) => {
              const Icon = ACTION_ICON[e.action] ?? Edit3
              const colors = ACTION_COLOR[e.action] ?? { bg: 'bg-muted', text: 'text-foreground' }
              const isOpen = expanded === e.id
              const diff = diffStates(e.beforeState, e.afterState)

              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-start hover:bg-muted/30"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        colors.bg,
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', colors.text)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium text-foreground">
                          {e.actorName ?? t('unknownActor')}
                        </span>
                        {e.actorRole && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {e.actorRole}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {t(`actions.${e.action}`)}
                        </span>
                        <span className="font-mono text-xs">
                          {t(`entities.${e.entityType}`)}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {e.entityId.slice(0, 8)}
                        </span>
                        {showCompanyColumn && (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-mono text-violet-700">
                            {e.companyId.slice(0, 8)}
                          </span>
                        )}
                      </p>
                      {e.notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{e.notes}</p>
                      )}
                      {diff.length > 0 && !isOpen && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {diff
                            .slice(0, 3)
                            .map(
                              (d) =>
                                `${d.key}: ${renderValue(d.before)} → ${renderValue(d.after)}`,
                            )
                            .join(' · ')}
                          {diff.length > 3 ? ` · +${diff.length - 3}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <time className="text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt, locale)}
                      </time>
                      {(diff.length > 0 || e.notes || e.ipAddress) &&
                        (isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ))}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/20 px-5 py-3">
                      {diff.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {t('diff.title')}
                          </p>
                          <ul className="divide-y rounded-md border bg-card">
                            {diff.map((d) => (
                              <li
                                key={d.key}
                                className="grid grid-cols-1 gap-1 px-3 py-2 text-xs sm:grid-cols-[140px_1fr_1fr]"
                              >
                                <span className="font-mono font-semibold text-muted-foreground">
                                  {d.key}
                                </span>
                                <span className="break-all rounded bg-rose-50 px-1.5 py-0.5 font-mono text-rose-800">
                                  {renderValue(d.before)}
                                </span>
                                <span className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-emerald-800">
                                  {renderValue(d.after)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('diff.noChanges')}
                        </p>
                      )}

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                        {e.ipAddress && (
                          <div>
                            <dt className="font-bold text-muted-foreground">
                              {t('meta.ip')}
                            </dt>
                            <dd className="font-mono">{e.ipAddress}</dd>
                          </div>
                        )}
                        {e.userAgent && (
                          <div className="col-span-3">
                            <dt className="font-bold text-muted-foreground">
                              {t('meta.userAgent')}
                            </dt>
                            <dd className="truncate font-mono" title={e.userAgent}>
                              {e.userAgent}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="font-bold text-muted-foreground">{t('meta.entityId')}</dt>
                          <dd className="break-all font-mono">{e.entityId}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-muted-foreground">{t('meta.auditId')}</dt>
                          <dd className="break-all font-mono">{e.id}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="border-t bg-muted/20 px-5 py-2 text-center text-[11px] text-muted-foreground">
            {t('rowsCap', { count: entries.length, navAccountingLabel: tNav('accounting') })}
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'indigo' | 'emerald' | 'violet' | 'slate'
}) {
  const map = {
    blue: { c: 'text-blue-600', b: 'bg-blue-100' },
    indigo: { c: 'text-indigo-600', b: 'bg-indigo-100' },
    emerald: { c: 'text-emerald-600', b: 'bg-emerald-100' },
    violet: { c: 'text-violet-600', b: 'bg-violet-100' },
    slate: { c: 'text-slate-600', b: 'bg-slate-100' },
  } as const
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', map[tone].b)}>
          <Icon className={cn('h-4 w-4', map[tone].c)} />
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (v: string) => void
}) {
  const t = useTranslations('audit')
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{t('filters.all')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  )
}
