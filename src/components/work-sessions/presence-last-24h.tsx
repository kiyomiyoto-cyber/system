'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react'
import { useWorkSessionsLast24h } from '@/hooks/use-work-sessions'
import type { EnrichedWorkSession } from '@/actions/work-sessions'
import { StarRating } from './star-rating'

interface PresenceLast24hProps {
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

function hoursBetween(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return (end - new Date(startIso).getTime()) / 3_600_000
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

export function PresenceLast24h({ companyId }: PresenceLast24hProps) {
  const t = useTranslations('workSessions.presence')
  const tRoles = useTranslations('settings.role')
  const locale = useLocale()
  const { data, isLoading, error } = useWorkSessionsLast24h(companyId)

  const stats = useMemo(() => {
    const list: EnrichedWorkSession[] = data ?? []
    const active = list.filter((s) => !s.check_out_at).length
    const blockers = list.filter((s) => s.blockers && s.blockers.trim()).length
    const uniqueMembers = new Set(list.map((s) => s.user_id)).size
    const totalHours = list.reduce(
      (acc, s) => acc + hoursBetween(s.check_in_at, s.check_out_at),
      0,
    )
    const avgHours = list.length ? totalHours / list.length : 0
    return { total: list.length, active, avgHours, blockers, uniqueMembers }
  }, [data])

  return (
    <div className="rounded-2xl bg-card shadow-soft ring-1 ring-border">
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{t('title')}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Link
          href={`/${locale}/presence`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t('viewAll')}
          <ArrowRight className="h-3.5 w-3.5 rtl-flip" />
        </Link>
      </div>

      <div className="space-y-4 p-5">
        {/* Summary chips */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {t('stats.sessions')}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-[11px] text-muted-foreground">
              {t('stats.uniqueMembers', { count: stats.uniqueMembers })}
            </div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t('stats.activeNow')}
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</div>
            <div className="text-[11px] text-muted-foreground">{t('stats.working')}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {t('stats.avgDuration')}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.avgHours.toFixed(1)}h
            </div>
            <div className="text-[11px] text-muted-foreground">{t('stats.perSession')}</div>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              stats.blockers > 0 ? 'bg-rose-500/5' : 'bg-muted/30'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs ${
                stats.blockers > 0 ? 'text-rose-700' : 'text-muted-foreground'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              {t('stats.blockers')}
            </div>
            <div
              className={`mt-1 text-2xl font-bold ${
                stats.blockers > 0 ? 'text-rose-700' : 'text-foreground'
              }`}
            >
              {stats.blockers}
            </div>
            <div className="text-[11px] text-muted-foreground">{t('stats.toReview')}</div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {t('error', { message: (error as Error).message })}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-sm text-muted-foreground">
            <Clock className="mb-2 h-8 w-8 opacity-50" />
            {t('empty')}
          </div>
        ) : (
          <div className="max-h-[420px] divide-y overflow-auto rounded-lg border">
            {data.map((s) => {
              const isOpen = !s.check_out_at
              const hasBlocker = Boolean(s.blockers && s.blockers.trim())
              const fullName = s.user?.full_name ?? t('row.unknown')
              const role = s.role || s.user?.role || 'member'
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[1.4fr_1fr_1fr_0.6fr]"
                >
                  {/* Member */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                      {initialsOf(fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {fullName}
                      </div>
                      <div className="text-[11px] capitalize text-muted-foreground">
                        {(KNOWN_ROLES as readonly string[]).includes(role) ? tRoles(role) : role}
                      </div>
                    </div>
                  </div>

                  {/* Hours */}
                  <div>
                    <div className="flex items-baseline gap-1.5 font-mono text-xs">
                      <span className="font-semibold text-emerald-600">
                        {formatTime(s.check_in_at, locale)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      {isOpen ? (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-300 px-2 text-[10px] text-emerald-700">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          {t('row.inProgress')}
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-600">
                          {formatTime(s.check_out_at!, locale)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDurationHours(s.check_in_at, s.check_out_at)}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-0.5">
                    {s.prod_rating || s.motiv_rating ? (
                      <>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-9 text-muted-foreground">{t('row.prod')}</span>
                          {s.prod_rating ? (
                            <StarRating value={s.prod_rating} readOnly size={12} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-9 text-muted-foreground">{t('row.motiv')}</span>
                          {s.motiv_rating ? (
                            <StarRating value={s.motiv_rating} readOnly size={12} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="md:text-end">
                    {hasBlocker ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                        title={s.blockers ?? ''}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {t('row.blocker')}
                      </span>
                    ) : isOpen ? (
                      <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                        —
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('row.ok')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
