import { getTranslations } from 'next-intl/server'
import { History, CheckCircle2, XCircle, Edit3, Plus, Send, Archive, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/formatters'

interface AuditLogRow {
  id: string
  action: string
  entity_type: string
  entity_id: string
  notes: string | null
  actor_name: string | null
  actor_role: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  created_at: string
}

interface AuditLogFeedProps {
  entries: AuditLogRow[]
  locale: 'fr' | 'ar'
}

const ACTION_ICON: Record<string, LucideIcon> = {
  create: Plus,
  validate: CheckCircle2,
  reject: XCircle,
  complete: Edit3,
  update: Edit3,
  send: Send,
  archive: Archive,
  delete: Trash2,
}

const ACTION_COLOR: Record<string, string> = {
  create: 'text-blue-600 bg-blue-50',
  validate: 'text-emerald-600 bg-emerald-50',
  reject: 'text-red-600 bg-red-50',
  complete: 'text-violet-600 bg-violet-50',
  update: 'text-violet-600 bg-violet-50',
  send: 'text-amber-600 bg-amber-50',
  archive: 'text-muted-foreground bg-muted',
  delete: 'text-red-700 bg-red-50',
}

function summarize(entry: AuditLogRow): string {
  const after = entry.after_state ?? {}
  const before = entry.before_state ?? {}
  if (entry.action === 'create' && typeof after.amount_ttc === 'number') {
    return String(after.amount_ttc)
  }
  if (entry.action === 'reject' && entry.notes) {
    return entry.notes
  }
  if (entry.action === 'complete') {
    const changed = Object.keys(after).filter((key) => before[key] !== after[key])
    if (changed.length > 0) return changed.join(', ')
  }
  return ''
}

export async function AuditLogFeed({ entries, locale }: AuditLogFeedProps) {
  const t = await getTranslations('accounting')

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <History className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-foreground">{t('audit.title')}</h2>
        <span className="ms-auto text-xs text-muted-foreground">
          {t('audit.subtitle')}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t('audit.empty')}
        </p>
      ) : (
        <ol className="divide-y">
          {entries.map((entry) => {
            const Icon = ACTION_ICON[entry.action] ?? Edit3
            const colors = ACTION_COLOR[entry.action] ?? 'text-foreground bg-muted'
            const detail = summarize(entry)
            return (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{entry.actor_name ?? t('audit.unknownActor')}</span>
                    {entry.actor_role && (
                      <span className="ms-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.actor_role}
                      </span>
                    )}
                    <span className="ms-1.5 text-muted-foreground">
                      {t(`audit.actions.${entry.action}`)}
                    </span>
                    <span className="ms-1.5 text-muted-foreground">
                      {t(`audit.entities.${entry.entity_type}`)}
                    </span>
                  </p>
                  {detail && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(entry.created_at, locale)}
                </time>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
