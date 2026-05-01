'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Clock, Users } from 'lucide-react'
import { useAdminWorkSessions } from '@/hooks/use-work-sessions'
import type { EnrichedWorkSession } from '@/actions/work-sessions'
import { StarRating } from './star-rating'

interface AdminWorkSessionsProps {
  companyId: string | null
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDurationHours(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const ms = end - new Date(startIso).getTime()
  const hours = ms / 3_600_000
  return `${hours.toFixed(1)}h`
}

function formatDateHeading(d: Date, locale: string) {
  const tag = locale === 'ar' ? 'ar-MA' : 'fr-FR'
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' })
  const month = d.toLocaleDateString(tag, { month: 'short' })
  return `${weekday}, ${d.getDate()} ${month}`
}

function formatMonthYear(d: Date, locale: string) {
  const tag = locale === 'ar' ? 'ar-MA' : 'fr-FR'
  return d.toLocaleDateString(tag, { month: 'long', year: 'numeric' })
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initialsOf(name: string | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last || '?').toUpperCase()
}

const KNOWN_ROLES = [
  'super_admin',
  'company_admin',
  'dispatcher',
  'comptable',
  'driver',
  'client',
] as const

export function AdminWorkSessions({ companyId }: AdminWorkSessionsProps) {
  const t = useTranslations('workSessions.admin')
  const tRoles = useTranslations('settings.role')
  const locale = useLocale()
  const { data, isLoading, error } = useAdminWorkSessions(companyId)

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ key: string; date: Date; rows: EnrichedWorkSession[] }>
    const map = new Map<string, EnrichedWorkSession[]>()
    for (const s of data) {
      const k = dayKey(s.check_in_at)
      const arr = map.get(k) ?? []
      arr.push(s)
      map.set(k, arr)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, rows]) => ({ key, date: new Date(rows[0].check_in_at), rows }))
  }, [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t('error', { message: (error as Error).message })}
      </div>
    )
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center text-muted-foreground shadow-soft">
        <Clock className="mb-3 h-10 w-10 opacity-50" />
        <div>{t('empty')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ key, date, rows }) => (
        <div
          key={key}
          className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border"
        >
          <div className="flex items-center gap-4 border-b bg-muted/40 px-5 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-background text-lg font-bold text-foreground">
              {date.getDate()}
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold capitalize text-foreground">
                {formatDateHeading(date, locale)}
              </div>
              <div className="text-xs capitalize text-muted-foreground">
                {formatMonthYear(date, locale)}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Users className="h-3 w-3" />
              {t('memberCount', { count: rows.length })}
            </span>
          </div>

          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1.5fr_0.6fr] gap-4 border-b bg-muted/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
            <div>{t('cols.member')}</div>
            <div>{t('cols.workHours')}</div>
            <div>{t('cols.feedback')}</div>
            <div>{t('cols.notes')}</div>
            <div className="text-end">{t('cols.blockers')}</div>
          </div>

          <div className="divide-y">
            {rows.map((s) => {
              const hasBlocker = Boolean(s.blockers && s.blockers.trim())
              const isOpen = !s.check_out_at
              const fullName = s.user?.full_name ?? t('row.unknown')
              const role = s.role || s.user?.role || 'member'

              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 items-start gap-4 px-6 py-4 lg:grid-cols-[1.5fr_1fr_1fr_1.5fr_0.6fr]"
                >
                  {/* Member */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                      {initialsOf(fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{fullName}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {(KNOWN_ROLES as readonly string[]).includes(role) ? tRoles(role) : role}
                      </div>
                    </div>
                  </div>

                  {/* Work hours */}
                  <div>
                    <div className="flex items-baseline gap-1.5 font-mono text-sm">
                      <span className="font-semibold text-emerald-600">
                        {formatTime(s.check_in_at, locale)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      {s.check_out_at ? (
                        <span className="font-semibold text-emerald-600">
                          {formatTime(s.check_out_at, locale)}
                        </span>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-full border border-emerald-300 px-2 text-[10px] text-emerald-700">
                          {t('row.inProgress')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDurationHours(s.check_in_at, s.check_out_at)}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-muted-foreground">{t('row.prod')}</span>
                      {s.prod_rating ? (
                        <StarRating value={s.prod_rating} readOnly size={14} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-muted-foreground">{t('row.motiv')}</span>
                      {s.motiv_rating ? (
                        <StarRating value={s.motiv_rating} readOnly size={14} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                    {s.notes?.trim() ? (
                      s.notes
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Blockers */}
                  <div className="lg:text-end">
                    {isOpen ? (
                      <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        —
                      </span>
                    ) : hasBlocker ? (
                      <span
                        className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700"
                        title={s.blockers ?? ''}
                      >
                        {t('row.yes')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        {t('row.no')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
