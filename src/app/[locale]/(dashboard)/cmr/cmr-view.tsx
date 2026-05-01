'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  FileText,
  Loader2,
  X,
  Save,
  Globe2,
  Search,
  CheckCircle2,
  Ban,
  Send,
  Edit3,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createOrGetCmrForShipment,
  generateCmrPdf,
  getCmrSignedUrl,
  cancelCmr,
} from '@/actions/cmr'

export type CmrStatus = 'draft' | 'issued' | 'signed' | 'cancelled'

export interface CmrRowVm {
  id: string
  cmrNumber: string
  status: CmrStatus
  senderName: string
  consigneeName: string
  deliveryPlace: string
  deliveryCountry: string
  takingOverCountry: string
  chargesTotalMad: number
  hasPdf: boolean
  pdfGeneratedAt: string | null
  issuedDate: string
  createdAt: string
  shipmentId: string | null
  shipmentReference: string
}

export interface EligibleShipmentVm {
  id: string
  reference: string
  pickupCity: string
  deliveryCity: string
  pickupCountry: string
  deliveryCountry: string
  status: string
  isInternational: boolean
  clientName: string
}

interface ViewProps {
  cmrs: CmrRowVm[]
  eligibleShipments: EligibleShipmentVm[]
  canEdit: boolean
  counts: { draft: number; issued: number; signed: number; cancelled: number }
  internationalEnabled: boolean
}

const STATUS_COLORS: Record<CmrStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  issued: 'bg-blue-100 text-blue-700 ring-blue-200',
  signed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 ring-rose-200',
}

const STATUS_ICON: Record<CmrStatus, React.ComponentType<{ className?: string }>> = {
  draft: Edit3,
  issued: Send,
  signed: CheckCircle2,
  cancelled: Ban,
}

function formatCurrency(amount: number, locale: string): string {
  if (amount === 0) return '—'
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(d: string | null, locale: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function CmrView({
  cmrs,
  eligibleShipments,
  canEdit,
  counts,
  internationalEnabled,
}: ViewProps) {
  const t = useTranslations('cmr')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<CmrStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<CmrRowVm | null>(null)

  const filtered = useMemo(() => {
    let out = cmrs
    if (statusFilter !== 'all') out = out.filter((c) => c.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(
        (c) =>
          c.cmrNumber.toLowerCase().includes(q) ||
          c.senderName.toLowerCase().includes(q) ||
          c.consigneeName.toLowerCase().includes(q) ||
          c.deliveryPlace.toLowerCase().includes(q) ||
          c.shipmentReference.toLowerCase().includes(q),
      )
    }
    return out
  }, [cmrs, statusFilter, search])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('stats.draft')}
          value={`${counts.draft}`}
          subtitle={t('stats.draftSubtitle')}
          icon={Edit3}
          tone="slate"
        />
        <KpiCard
          label={t('stats.issued')}
          value={`${counts.issued}`}
          subtitle={t('stats.issuedSubtitle')}
          icon={Send}
          tone="blue"
        />
        <KpiCard
          label={t('stats.signed')}
          value={`${counts.signed}`}
          subtitle={t('stats.signedSubtitle')}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label={t('stats.eligible')}
          value={`${eligibleShipments.length}`}
          subtitle={t('stats.eligibleSubtitle')}
          icon={Sparkles}
          tone={eligibleShipments.length > 0 ? 'amber' : 'slate'}
        />
      </div>

      {!internationalEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft">
          <div className="flex items-start gap-3">
            <Globe2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">{t('flagDisabled.title')}</p>
              <p className="mt-1 text-xs">{t('flagDisabled.subtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="h-9 w-72 rounded-lg border bg-background ps-8 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex rounded-lg border bg-background p-0.5">
              {(['all', 'draft', 'issued', 'signed', 'cancelled'] as const).map((k) => {
                const count =
                  k === 'all'
                    ? cmrs.length
                    : k === 'draft'
                      ? counts.draft
                      : k === 'issued'
                        ? counts.issued
                        : k === 'signed'
                          ? counts.signed
                          : counts.cancelled
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStatusFilter(k)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition',
                      statusFilter === k
                        ? 'bg-primary text-primary-foreground shadow-soft'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {k === 'all' ? t('filter.all') : t(`status.${k}`)}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        statusFilter === k ? 'bg-white/20' : 'bg-muted',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {canEdit && eligibleShipments.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t('actions.newCmr')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {cmrs.length === 0 ? t('empty.title') : t('empty.filtered')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cmrs.length === 0
              ? t('empty.subtitle')
              : t('empty.adjustFilters')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{t('table.cmrNumber')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('table.status')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('table.shipment')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('table.route')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('table.parties')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('table.charges')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => {
                  const Icon = STATUS_ICON[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold">{c.cmrNumber}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(c.issuedDate, locale)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                            STATUS_COLORS[c.status],
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {t(`status.${c.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs">{c.shipmentReference}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-xs">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
                            {c.takingOverCountry}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
                            {c.deliveryCountry}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.deliveryPlace}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-xs">
                          <span className="text-muted-foreground">{t('table.from')}: </span>
                          {c.senderName || '—'}
                        </p>
                        <p className="truncate text-xs">
                          <span className="text-muted-foreground">{t('table.to')}: </span>
                          {c.consigneeName || (
                            <span className="italic text-rose-600">{t('table.consigneeMissing')}</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-end font-mono tabular-nums">
                        {formatCurrency(c.chargesTotalMad, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.hasPdf ? (
                            <button
                              type="button"
                              title={t('actions.viewPdf')}
                              disabled={isPending}
                              onClick={() => {
                                startTransition(async () => {
                                  const r = await getCmrSignedUrl(c.id)
                                  if (r.error || !r.data) toast.error(r.error ?? '—')
                                  else
                                    window.open(r.data.url, '_blank', 'noopener,noreferrer')
                                })
                              }}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          ) : (
                            canEdit &&
                            c.status !== 'cancelled' && (
                              <button
                                type="button"
                                title={t('actions.generatePdf')}
                                disabled={isPending}
                                onClick={() => {
                                  startTransition(async () => {
                                    const r = await generateCmrPdf(c.id)
                                    if (r.error) toast.error(r.error)
                                    else {
                                      toast.success(t('toast.pdfGenerated'))
                                      router.refresh()
                                    }
                                  })
                                }}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )
                          )}
                          {canEdit && c.status !== 'cancelled' && c.status !== 'signed' && (
                            <button
                              type="button"
                              title={t('actions.cancel')}
                              disabled={isPending}
                              onClick={() => setCancelling(c)}
                              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <CreateDialog
          shipments={eligibleShipments}
          onClose={() => setCreating(false)}
          onSubmit={(shipmentId) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await createOrGetCmrForShipment(shipmentId)
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(
                  r.data?.created
                    ? t('toast.created', { number: r.data.cmrNumber })
                    : t('toast.alreadyExists', { number: r.data?.cmrNumber ?? '' }),
                )
                router.refresh()
                resolve(true)
              })
            })
          }
        />
      )}

      {cancelling && (
        <CancelDialog
          cmr={cancelling}
          onClose={() => setCancelling(null)}
          onSubmit={(reason) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await cancelCmr(cancelling.id, reason)
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(t('toast.cancelled'))
                router.refresh()
                resolve(true)
              })
            })
          }
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
  tone: 'slate' | 'blue' | 'emerald' | 'amber'
}) {
  const map = {
    slate: { c: 'text-slate-600', b: 'bg-slate-100' },
    blue: { c: 'text-blue-600', b: 'bg-blue-100' },
    emerald: { c: 'text-emerald-600', b: 'bg-emerald-100' },
    amber: { c: 'text-amber-600', b: 'bg-amber-100' },
  } as const
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', map[tone].b)}>
          <Icon className={cn('h-4 w-4', map[tone].c)} />
        </div>
      </div>
    </div>
  )
}

function CreateDialog({
  shipments,
  onClose,
  onSubmit,
}: {
  shipments: EligibleShipmentVm[]
  onClose: () => void
  onSubmit: (shipmentId: string) => Promise<boolean>
}) {
  const t = useTranslations('cmr')
  const [shipmentId, setShipmentId] = useState<string>(shipments[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shipmentId) return
    setSubmitting(true)
    const ok = await onSubmit(shipmentId)
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <DialogShell title={t('dialog.createTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">{t('dialog.createDescription')}</p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t('dialog.eligibleShipment')}</span>
          <select
            required
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference} — {s.clientName} ({s.pickupCity}/{s.pickupCountry} →{' '}
                {s.deliveryCity}/{s.deliveryCountry})
                {!s.isInternational ? ' ⚠' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {t('dialog.eligibleHint')}
          </p>
        </label>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {t('actions.close')}
          </button>
          <button
            type="submit"
            disabled={!shipmentId || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('actions.create')}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function CancelDialog({
  cmr,
  onClose,
  onSubmit,
}: {
  cmr: CmrRowVm
  onClose: () => void
  onSubmit: (reason: string) => Promise<boolean>
}) {
  const t = useTranslations('cmr')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    const ok = await onSubmit(reason.trim())
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <DialogShell title={t('dialog.cancelTitle', { number: cmr.cmrNumber })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">{t('dialog.cancelDescription')}</p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t('dialog.cancelReason')}</span>
          <textarea
            required
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
            placeholder={t('dialog.cancelReasonPlaceholder')}
          />
        </label>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {t('actions.close')}
          </button>
          <button
            type="submit"
            disabled={!reason.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {t('actions.confirmCancel')}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-6 shadow-soft-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
