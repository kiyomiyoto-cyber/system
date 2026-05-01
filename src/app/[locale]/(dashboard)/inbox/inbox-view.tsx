'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCheck,
  Filter,
  Mail,
  MessageCircle,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markAllInboxRead,
  markInboxRead,
  type InboxRow,
} from '@/actions/inbox'

interface ViewProps {
  items: InboxRow[]
  locale: string
  loadError: string | null
}

type KindFilter = 'all' | 'whatsapp_out' | 'notification_out'
type AudienceFilter = 'all' | 'driver' | 'client' | 'subcontractor' | 'internal'

const KIND_TONE: Record<'whatsapp_out' | 'notification_out', { bg: string; text: string; ring: string; Icon: typeof MessageCircle }> = {
  whatsapp_out: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    Icon: MessageCircle,
  },
  notification_out: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    Icon: Mail,
  },
}

const STATUS_TONE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  skipped: 'bg-slate-100 text-slate-700 ring-slate-200',
}

function formatRelative(iso: string, locale: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return locale === 'ar' ? 'الآن' : 'à l\'instant'
  if (min < 60) return locale === 'ar' ? `قبل ${min} د` : `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return locale === 'ar' ? `قبل ${h} س` : `il y a ${h} h`
  const d = Math.round(h / 24)
  return locale === 'ar' ? `قبل ${d} ي` : `il y a ${d} j`
}

export function InboxView({ items, locale, loadError }: ViewProps) {
  const t = useTranslations('inbox')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InboxRow | null>(null)
  const [isMarking, startMark] = useTransition()
  const [isMarkAll, startMarkAll] = useTransition()

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter((i) => {
      if (kindFilter !== 'all' && i.kind !== kindFilter) return false
      if (audienceFilter !== 'all' && i.audience !== audienceFilter) return false
      if (unreadOnly && i.isRead) return false
      if (s) {
        const hay = [
          i.body,
          i.subject ?? '',
          i.recipient ?? '',
          i.recipientName ?? '',
          i.templateKey ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [items, kindFilter, audienceFilter, unreadOnly, search])

  const handleSelect = (row: InboxRow) => {
    setSelected(row)
    if (!row.isRead) {
      startMark(() => {
        void (async () => {
          const res = await markInboxRead({
            kind: row.kind,
            sourceId: row.sourceId,
          })
          if (res.error) {
            toast.error(t('toast.markFailed'), { description: res.error })
            return
          }
          router.refresh()
        })()
      })
    }
  }

  const handleMarkAll = () => {
    startMarkAll(() => {
      void (async () => {
        const res = await markAllInboxRead()
        if (res.error) {
          toast.error(t('toast.markAllFailed'), { description: res.error })
          return
        }
        toast.success(t('toast.markedAll', { count: res.data?.count ?? 0 }))
        router.refresh()
      })()
    })
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-semibold">{t('error.loadFailed')}</p>
        <p className="mt-1 font-mono text-xs">{loadError}</p>
      </div>
    )
  }

  const unread = items.filter((i) => !i.isRead).length

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-soft">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm focus-within:ring-1 focus-within:ring-primary/40">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5 text-xs">
          {(['all', 'whatsapp_out', 'notification_out'] as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                kindFilter === k
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`filters.kind.${k}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5 text-xs">
          {(['all', 'driver', 'client', 'subcontractor', 'internal'] as AudienceFilter[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudienceFilter(a)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                audienceFilter === a
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`filters.audience.${a}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setUnreadOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
            unreadOnly
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          <Filter className="h-3 w-3" />
          {t('filters.unreadOnly')}
        </button>

        <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('filters.shown', { shown: filtered.length, total: items.length })}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={isMarkAll}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60 focus-ring"
            >
              <CheckCheck className="h-3 w-3" />
              {t('actions.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List */}
        <div className="rounded-xl border bg-card shadow-soft">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
              <Search className="mb-2 h-8 w-8 opacity-50" />
              <p>{t('list.empty')}</p>
            </div>
          ) : (
            <ul className="max-h-[640px] divide-y overflow-y-auto">
              {filtered.map((row) => {
                const tone =
                  row.kind === 'whatsapp_out' || row.kind === 'notification_out'
                    ? KIND_TONE[row.kind]
                    : KIND_TONE.notification_out
                const Icon = tone.Icon
                return (
                  <li key={row.feedId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(row)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-muted/40 focus-ring',
                        selected?.feedId === row.feedId && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                          tone.bg,
                          tone.text,
                          tone.ring,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'truncate text-xs',
                              row.isRead ? 'font-medium text-muted-foreground' : 'font-bold text-foreground',
                            )}
                          >
                            {row.recipientName ?? row.recipient ?? '—'}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatRelative(row.occurredAt, locale)}
                          </span>
                        </div>
                        {row.subject && (
                          <p className="truncate text-[11px] font-semibold text-foreground">
                            {row.subject}
                          </p>
                        )}
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {row.body}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1',
                              STATUS_TONE[row.status] ?? STATUS_TONE.skipped,
                            )}
                          >
                            {t(`status.${row.status}`, { default: row.status })}
                          </span>
                          {row.templateKey && (
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {row.templateKey}
                            </span>
                          )}
                          {!row.isRead && (
                            <span className="ms-auto h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-xl border bg-card shadow-soft">
          {!selected ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
              <Mail className="mb-2 h-8 w-8 opacity-50" />
              <p>{t('detail.empty')}</p>
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t(`filters.kind.${selected.kind}`)} · {selected.audience}
                  </p>
                  <h3 className="mt-1 truncate text-base font-bold text-foreground">
                    {selected.subject ?? selected.templateKey ?? selected.recipient ?? '—'}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selected.recipientName ? `${selected.recipientName} · ` : ''}
                    <span className="font-mono">{selected.recipient}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
                  aria-label={tCommon('close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selected.errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">{t('detail.errorTitle')}</p>
                    <p className="mt-0.5 break-all font-mono">{selected.errorMessage}</p>
                  </div>
                </div>
              )}

              <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                {selected.body}
              </pre>

              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">
                    {t('detail.occurredAt')}
                  </span>{' '}
                  {new Date(selected.occurredAt).toLocaleString('fr-MA', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    {t('detail.status')}
                  </span>{' '}
                  {selected.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.shipmentId && (
                  <Link
                    href={`/${locale}/shipments/${selected.shipmentId}`}
                    className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted focus-ring"
                  >
                    {t('detail.viewShipment')}
                  </Link>
                )}
                {selected.invoiceId && (
                  <Link
                    href={`/${locale}/invoices/${selected.invoiceId}`}
                    className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted focus-ring"
                  >
                    {t('detail.viewInvoice')}
                  </Link>
                )}
                {isMarking && (
                  <span className="text-[10px] text-muted-foreground">
                    {t('detail.markingRead')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
