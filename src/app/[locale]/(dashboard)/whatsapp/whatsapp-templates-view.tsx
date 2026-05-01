'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Edit3,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  deleteWhatsappTemplate,
  upsertWhatsappTemplate,
  type WhatsappAudience,
} from '@/actions/whatsapp'

export interface TemplateRow {
  id: string
  key: string
  name: string
  audience: WhatsappAudience
  body: string
  isActive: boolean
  updatedAt: string
}

export interface SendLogRow {
  id: string
  templateKey: string | null
  audience: WhatsappAudience
  recipientPhone: string
  recipientName: string | null
  bodyRendered: string
  sentAt: string
  shipmentId: string | null
  sentByName: string | null
}

interface ViewProps {
  templates: TemplateRow[]
  sendLog: SendLogRow[]
  canEdit: boolean
  locale: string
}

const AUDIENCE_TONE: Record<WhatsappAudience, { bg: string; text: string }> = {
  driver: { bg: 'bg-blue-100', text: 'text-blue-700' },
  client: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  subcontractor: { bg: 'bg-amber-100', text: 'text-amber-800' },
  internal: { bg: 'bg-slate-100', text: 'text-slate-700' },
}

type TabKey = 'templates' | 'log'

export function WhatsappTemplatesView({ templates, sendLog, canEdit, locale }: ViewProps) {
  const t = useTranslations('whatsapp')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('templates')

  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.templates', { count: templates.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('log')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'log'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.log', { count: sendLog.length })}
        </button>
        {canEdit && tab === 'templates' && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('actions.newTemplate')}
          </button>
        )}
      </div>

      {tab === 'templates' ? (
        templates.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            {t('templates.empty')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((tpl) => {
              const tone = AUDIENCE_TONE[tpl.audience]
              return (
                <div
                  key={tpl.id}
                  className={cn(
                    'rounded-xl border bg-card p-4 shadow-soft',
                    !tpl.isActive && 'opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-foreground">{tpl.name}</h3>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {tpl.key}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        tone.bg,
                        tone.text,
                      )}
                    >
                      {t(`audience.${tpl.audience}`)}
                    </span>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-foreground">
                    {tpl.body}
                  </pre>
                  {canEdit && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(tpl)}
                        className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted focus-ring"
                      >
                        <Edit3 className="h-3 w-3" />
                        {tCommon('edit')}
                      </button>
                      {!tpl.isActive && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('templates.inactive')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : sendLog.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('log.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.sentAt')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.audience')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.recipient')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.template')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.sentBy')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.col.shipment')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sendLog.map((row) => {
                const tone = AUDIENCE_TONE[row.audience]
                return (
                  <tr key={row.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-muted-foreground">
                      {new Date(row.sentAt).toLocaleString('fr-MA', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          tone.bg,
                          tone.text,
                        )}
                      >
                        {t(`audience.${row.audience}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <p className="font-medium">{row.recipientName ?? '—'}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {row.recipientPhone}
                      </p>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.templateKey ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.sentByName ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      {row.shipmentId ? (
                        <Link
                          href={`/${locale}/shipments/${row.shipmentId}`}
                          className="font-mono text-[11px] font-semibold text-primary hover:underline"
                        >
                          {t('log.viewShipment')}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <TemplateEditorDialog
          template={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSaved={() => {
            setEditing(null)
            setCreating(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function TemplateEditorDialog({
  template,
  onClose,
  onSaved,
}: {
  template: TemplateRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('whatsapp.editor')
  const tCommon = useTranslations('common')
  const [key, setKey] = useState(template?.key ?? '')
  const [name, setName] = useState(template?.name ?? '')
  const [audience, setAudience] = useState<WhatsappAudience>(
    template?.audience ?? 'client',
  )
  const [body, setBody] = useState(template?.body ?? '')
  const [isActive, setIsActive] = useState(template?.isActive ?? true)
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const valid = key.trim().length >= 2 && name.trim().length >= 1 && body.trim().length >= 1

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await upsertWhatsappTemplate({
          id: template?.id,
          key: key.trim(),
          name: name.trim(),
          audience,
          body: body.trim(),
          isActive,
        })
        if (res.error) {
          toast.error(t('toast.saveFailed'), { description: res.error })
          return
        }
        toast.success(template ? t('toast.updated') : t('toast.created'))
        onSaved()
      })()
    })
  }

  const handleDelete = () => {
    if (!template) return
    if (!window.confirm(t('confirmDelete'))) return
    startDelete(() => {
      void (async () => {
        const res = await deleteWhatsappTemplate(template.id)
        if (res.error) {
          toast.error(t('toast.deleteFailed'), { description: res.error })
          return
        }
        toast.success(t('toast.deleted'))
        onSaved()
      })()
    })
  }

  const placeholderHint = useMemo(
    () =>
      [
        '{{shipment_ref}}',
        '{{client_contact}}',
        '{{driver_first_name}}',
        '{{pickup_city}}',
        '{{delivery_city}}',
        '{{delivery_time}}',
        '{{company_name}}',
      ].join(' · '),
    [],
  )

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {template ? t('titleEdit') : t('titleNew')}
              </h3>
              <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {t('field.key')}
              </label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase())}
                placeholder="late_alert"
                className="w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <p className="text-[10px] text-muted-foreground">{t('field.keyHint')}</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {t('field.name')}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('field.namePlaceholder')}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {t('field.audience')}
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as WhatsappAudience)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="driver">{t('audience.driver')}</option>
                <option value="client">{t('audience.client')}</option>
                <option value="subcontractor">{t('audience.subcontractor')}</option>
                <option value="internal">{t('audience.internal')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {t('field.isActive')}
              </label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>{isActive ? t('field.active') : t('field.disabled')}</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              {t('field.body')}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="w-full resize-y rounded-lg border bg-card px-3 py-2 text-sm leading-relaxed font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">{t('field.placeholders')}</span>
              {' · '}
              <span className="font-mono">{placeholderHint}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-3">
          <div>
            {template && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 focus-ring"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {tCommon('delete')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-ring"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || isSaving}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
                valid && !isSaving
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {tCommon('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
