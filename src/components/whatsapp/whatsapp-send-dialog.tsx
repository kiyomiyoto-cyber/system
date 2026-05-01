'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildWaMeUrl } from '@/lib/whatsapp/url'
import {
  listWhatsappTemplates,
  recordWhatsappSend,
  renderWhatsappMessage,
  type RenderContextKind,
  type RenderedTemplate,
  type WhatsappAudience,
  type WhatsappTemplate,
} from '@/actions/whatsapp'

interface WhatsappSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Context that determines which records this send is linked to and which
   * variables are available. The dialog filters templates by the matching
   * audience(s) and pre-fills recipient phone where possible.
   */
  context: RenderContextKind
  /**
   * Optional initial templates to skip the first network round-trip when the
   * caller already has them.
   */
  initialTemplates?: WhatsappTemplate[]
  /** Called after the user confirms the send was completed. */
  onSent?: (info: { templateKey: string | null; phone: string }) => void
}

const AUDIENCE_LABEL_KEY: Record<WhatsappAudience, string> = {
  driver: 'audience.driver',
  client: 'audience.client',
  subcontractor: 'audience.subcontractor',
  internal: 'audience.internal',
}

export function WhatsappSendDialog({
  open,
  onOpenChange,
  context,
  initialTemplates,
  onSent,
}: WhatsappSendDialogProps) {
  const t = useTranslations('whatsapp.dialog')
  const tCommon = useTranslations('common')
  const tAudience = useTranslations('whatsapp')

  const [templates, setTemplates] = useState<WhatsappTemplate[]>(initialTemplates ?? [])
  const [templatesLoaded, setTemplatesLoaded] = useState(Boolean(initialTemplates))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [body, setBody] = useState('')
  const [rendered, setRendered] = useState<RenderedTemplate | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, startRender] = useTransition()
  const [isLogging, startLog] = useTransition()
  const [step, setStep] = useState<'compose' | 'confirm'>('compose')

  // ── Load templates filtered to the relevant audience(s) ─────────
  const audienceFilter = context.audience

  useEffect(() => {
    if (!open) return
    if (templatesLoaded) return
    let cancelled = false
    void (async () => {
      const res = await listWhatsappTemplates(audienceFilter)
      if (cancelled) return
      if (res.error || !res.data) {
        toast.error(t('toast.loadTemplatesFailed'), { description: res.error ?? undefined })
        return
      }
      setTemplates(res.data)
      setTemplatesLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [open, templatesLoaded, audienceFilter, t])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setPhone('')
      setRecipientName('')
      setBody('')
      setRendered(null)
      setRenderError(null)
      setStep('compose')
    }
  }, [open])

  // ── Render the selected template ────────────────────────────────
  const refreshRender = (templateId: string | null, customBody: string | null) => {
    startRender(() => {
      void (async () => {
        const res = await renderWhatsappMessage(templateId, customBody, context)
        if (res.error || !res.data) {
          setRenderError(res.error ?? t('error.renderFailed'))
          setRendered(null)
          return
        }
        setRenderError(null)
        setRendered(res.data)
        setBody(res.data.body)
        if (res.data.recipientPhone && !phone) setPhone(res.data.recipientPhone)
        if (res.data.recipientName && !recipientName) setRecipientName(res.data.recipientName)
      })()
    })
  }

  // When a template is picked → render once.
  useEffect(() => {
    if (!open) return
    if (!selectedId) return
    refreshRender(selectedId, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, open])

  // ── Phone normalization for wa.me ───────────────────────────────
  const phoneDigits = useMemo(() => phone.replace(/\D/g, ''), [phone])
  const phoneValid = phoneDigits.length >= 9
  const bodyTrimmed = body.trim()
  const canSend = phoneValid && bodyTrimmed.length > 0 && !isRendering

  const audienceList = useMemo<WhatsappAudience[]>(() => {
    const out: WhatsappAudience[] = [audienceFilter]
    if (audienceFilter !== 'internal') out.push('internal')
    return out
  }, [audienceFilter])

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.isActive && audienceList.includes(t.audience)),
    [templates, audienceList],
  )

  // ── Confirm + log + open WhatsApp ───────────────────────────────
  const handleSend = () => {
    if (!canSend) return
    const url = buildWaMeUrl(phoneDigits, bodyTrimmed)

    // Open the wa.me URL in a new tab — user finalizes send in WhatsApp.
    window.open(url, '_blank', 'noopener,noreferrer')
    setStep('confirm')
  }

  const handleConfirmSent = () => {
    startLog(() => {
      void (async () => {
        const res = await recordWhatsappSend({
          templateId: rendered?.templateId ?? null,
          templateKey: rendered?.templateKey ?? null,
          audience: rendered?.audience ?? audienceFilter,
          recipientPhone: phoneDigits,
          recipientName: recipientName.trim() || null,
          bodyRendered: bodyTrimmed,
          shipmentId: rendered?.shipmentId ?? null,
          clientId: rendered?.clientId ?? null,
          driverId: rendered?.driverId ?? null,
          subcontractorId: rendered?.subcontractorId ?? null,
        })
        if (res.error) {
          toast.error(t('toast.logFailed'), { description: res.error })
          return
        }
        toast.success(t('toast.sent'))
        onSent?.({ templateKey: rendered?.templateKey ?? null, phone: phoneDigits })
        onOpenChange(false)
      })()
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => !isLogging && onOpenChange(false)}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b bg-gradient-to-br from-emerald-500/5 to-emerald-500/0 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t('title')}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('subtitle', { audience: tAudience(AUDIENCE_LABEL_KEY[audienceFilter]) })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !isLogging && onOpenChange(false)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
              aria-label={tCommon('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {step === 'compose' ? (
            <>
              {/* Template picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  {t('field.template')}
                </label>
                {filteredTemplates.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                    {templatesLoaded ? t('templates.empty') : tCommon('loading')}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedId(tpl.id)}
                        className={cn(
                          'rounded-lg border p-2.5 text-start text-xs transition-colors focus-ring',
                          selectedId === tpl.id
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'hover:bg-muted/40',
                        )}
                      >
                        <p className="font-semibold text-foreground">{tpl.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                          {tpl.body.slice(0, 100)}
                          {tpl.body.length > 100 ? '…' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {t('field.phone')}
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-primary/40">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+212 6 12 34 56 78"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                      dir="ltr"
                    />
                  </div>
                  {!phoneValid && phone.length > 0 && (
                    <p className="text-[10px] text-amber-700">{t('field.phoneInvalid')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {t('field.recipientName')}
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t('field.recipientNamePlaceholder')}
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    {t('field.body')}
                  </label>
                  {selectedId && (
                    <button
                      type="button"
                      onClick={() => refreshRender(selectedId, null)}
                      disabled={isRendering}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={cn('h-3 w-3', isRendering && 'animate-spin')} />
                      {t('field.refreshFromTemplate')}
                    </button>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder={t('field.bodyPlaceholder')}
                  className="w-full resize-y rounded-lg border bg-card px-3 py-2 text-sm leading-relaxed font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                {renderError && (
                  <p className="text-[10px] text-rose-700">{renderError}</p>
                )}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{t('field.bodyHint')}</span>
                  <span className="tabular-nums">{bodyTrimmed.length} / 4000</span>
                </div>
              </div>
            </>
          ) : (
            // Confirm step — user has clicked, WhatsApp tab is open elsewhere.
            <div className="space-y-3 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                <Send className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-foreground">{t('confirm.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('confirm.subtitle')}</p>
              <div className="mx-auto max-w-md rounded-lg border bg-muted/30 px-3 py-2 text-start text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    {t('confirm.toLabel')}
                  </span>{' '}
                  {recipientName ? `${recipientName} · ` : ''}
                  <span className="font-mono">{phoneDigits}</span>
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-muted-foreground">
                  {bodyTrimmed.slice(0, 220)}
                  {bodyTrimmed.length > 220 ? '…' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t bg-muted/20 px-6 py-3 sm:flex-row sm:items-center sm:justify-end">
          {step === 'compose' ? (
            <>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-ring"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
                  canSend
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'cursor-not-allowed bg-muted text-muted-foreground',
                )}
              >
                <MessageCircle className="h-4 w-4" />
                {t('actions.openWhatsapp')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('compose')}
                className="inline-flex items-center justify-center rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-ring"
              >
                {t('actions.back')}
              </button>
              <button
                type="button"
                onClick={handleConfirmSent}
                disabled={isLogging}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus-ring"
              >
                {isLogging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('actions.confirmSent')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
