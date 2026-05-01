'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Globe2,
  FileCheck,
  FileWarning,
  FileText,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  setRequiredDocument,
  uploadCustomsDocument,
  deleteCustomsDocument,
  getCustomsDocumentSignedUrl,
} from '@/actions/free-zones'

export interface ZoneVm {
  id: string
  code: string
  name: string
  city: string
  country: string
  customsOfficeCode: string | null
  notes: string | null
  isActive: boolean
  requiredDocumentTypeIds: string[]
}

export interface DocumentTypeVm {
  id: string
  code: string
  name: string
  description: string | null
  applicableTo: 'import' | 'export' | 'both'
  requiredByDefault: boolean
  sortOrder: number
  isActive: boolean
}

export interface UploadedDocVm {
  id: string
  documentTypeId: string
  documentNumber: string | null
  documentDate: string | null
  fileName: string
  mimeType: string
  fileSizeBytes: number
  createdAt: string
}

export interface ZoneShipmentVm {
  id: string
  reference: string
  status: string
  pickupCity: string
  deliveryCity: string
  pickupFreeZoneId: string | null
  deliveryFreeZoneId: string | null
  deliveryScheduledAt: string | null
  clientName: string
  requiredDocumentTypeIds: string[]
  requiredCount: number
  uploadedCount: number
  complianceStatus: 'no_requirement' | 'complete' | 'missing' | 'partial'
  uploaded: UploadedDocVm[]
}

interface ViewProps {
  zones: ZoneVm[]
  documentTypes: DocumentTypeVm[]
  shipments: ZoneShipmentVm[]
  canEdit: boolean
  incompleteCount: number
}

type TabKey = 'shipments' | 'zones' | 'matrix'

const COMPLIANCE_COLORS: Record<
  ZoneShipmentVm['complianceStatus'],
  { ring: string; bg: string; text: string; dot: string }
> = {
  complete: {
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  partial: {
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  missing: {
    ring: 'ring-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
  },
  no_requirement: {
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
  },
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

function formatDate(d: string | null, locale: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function FreeZonesView({
  zones,
  documentTypes,
  shipments,
  canEdit,
  incompleteCount,
}: ViewProps) {
  const t = useTranslations('freeZones')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<TabKey>('shipments')
  const [uploadCtx, setUploadCtx] = useState<{ shipment: ZoneShipmentVm; documentTypeId: string } | null>(
    null,
  )

  const docTypesById = useMemo(
    () => new Map(documentTypes.map((d) => [d.id, d])),
    [documentTypes],
  )
  const zonesById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])

  const totals = useMemo(() => {
    let complete = 0
    let partial = 0
    let missing = 0
    for (const s of shipments) {
      if (s.complianceStatus === 'complete') complete += 1
      else if (s.complianceStatus === 'partial') partial += 1
      else if (s.complianceStatus === 'missing') missing += 1
    }
    return { complete, partial, missing }
  }, [shipments])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('stats.zones')}
          value={`${zones.filter((z) => z.isActive).length}`}
          subtitle={t('stats.zonesSubtitle')}
          icon={Globe2}
          tone="indigo"
        />
        <KpiCard
          label={t('stats.shipmentsTouchingFz')}
          value={`${shipments.length}`}
          subtitle={t('stats.shipmentsTouchingFzSubtitle')}
          icon={FileText}
          tone="blue"
        />
        <KpiCard
          label={t('stats.compliant')}
          value={`${totals.complete}`}
          subtitle={t('stats.compliantSubtitle')}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label={t('stats.incomplete')}
          value={`${totals.partial + totals.missing}`}
          subtitle={t('stats.incompleteSubtitle', {
            partial: totals.partial,
            missing: totals.missing,
          })}
          icon={AlertTriangle}
          tone={totals.partial + totals.missing > 0 ? 'amber' : 'slate'}
        />
      </div>

      {incompleteCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">{t('banner.title', { count: incompleteCount })}</p>
              <p className="mt-1 text-xs">{t('banner.subtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          {(['shipments', 'zones', 'matrix'] as TabKey[]).map((k) => {
            const count =
              k === 'shipments' ? shipments.length : k === 'zones' ? zones.length : documentTypes.length
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
      </div>

      {tab === 'shipments' && (
        <ShipmentsCompliance
          shipments={shipments}
          docTypesById={docTypesById}
          zonesById={zonesById}
          canEdit={canEdit}
          isPending={isPending}
          onUpload={(s, docTypeId) => setUploadCtx({ shipment: s, documentTypeId: docTypeId })}
          onView={(docId) => {
            startTransition(async () => {
              const r = await getCustomsDocumentSignedUrl(docId)
              if (r.error || !r.data) toast.error(r.error ?? '—')
              else window.open(r.data.url, '_blank', 'noopener,noreferrer')
            })
          }}
          onDelete={(docId) => {
            if (!confirm(t('confirmDelete'))) return
            startTransition(async () => {
              const r = await deleteCustomsDocument(docId)
              if (r.error) toast.error(r.error)
              else {
                toast.success(t('toast.deleted'))
                router.refresh()
              }
            })
          }}
        />
      )}

      {tab === 'zones' && <ZonesGrid zones={zones} docTypesById={docTypesById} />}

      {tab === 'matrix' && (
        <RequirementMatrix
          zones={zones}
          documentTypes={documentTypes}
          canEdit={canEdit}
          isPending={isPending}
          onToggle={(zoneId, docTypeId, isRequired) => {
            startTransition(async () => {
              const r = await setRequiredDocument({
                freeZoneId: zoneId,
                documentTypeId: docTypeId,
                isRequired,
              })
              if (r.error) toast.error(r.error)
              else {
                toast.success(t('toast.matrixUpdated'))
                router.refresh()
              }
            })
          }}
        />
      )}

      {uploadCtx && (
        <UploadDialog
          shipment={uploadCtx.shipment}
          documentType={docTypesById.get(uploadCtx.documentTypeId)!}
          onClose={() => setUploadCtx(null)}
          onSubmit={async ({ file, documentNumber, documentDate, notes }) => {
            const formData = new FormData()
            formData.set('file', file)
            const r = await uploadCustomsDocument({
              shipmentId: uploadCtx.shipment.id,
              documentTypeId: uploadCtx.documentTypeId,
              documentNumber: documentNumber || null,
              documentDate: documentDate || null,
              notes: notes || null,
              formData,
            })
            if (r.error) {
              toast.error(r.error)
              return false
            }
            toast.success(t('toast.uploaded'))
            router.refresh()
            return true
          }}
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
  tone: 'indigo' | 'blue' | 'emerald' | 'amber' | 'slate'
}) {
  const map = {
    indigo: { c: 'text-indigo-600', b: 'bg-indigo-100' },
    blue: { c: 'text-blue-600', b: 'bg-blue-100' },
    emerald: { c: 'text-emerald-600', b: 'bg-emerald-100' },
    amber: { c: 'text-amber-600', b: 'bg-amber-100' },
    slate: { c: 'text-slate-600', b: 'bg-slate-100' },
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

// ============================================================
function ShipmentsCompliance({
  shipments,
  docTypesById,
  zonesById,
  canEdit,
  isPending,
  onUpload,
  onView,
  onDelete,
}: {
  shipments: ZoneShipmentVm[]
  docTypesById: Map<string, DocumentTypeVm>
  zonesById: Map<string, ZoneVm>
  canEdit: boolean
  isPending: boolean
  onUpload: (s: ZoneShipmentVm, docTypeId: string) => void
  onView: (docId: string) => void
  onDelete: (docId: string) => void
}) {
  const t = useTranslations('freeZones')
  const locale = useLocale()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (shipments.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
        <p className="text-sm text-muted-foreground">{t('empty.shipments')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shipments.map((s) => {
        const colors = COMPLIANCE_COLORS[s.complianceStatus]
        const isOpen = expanded === s.id
        const pickupZone = s.pickupFreeZoneId ? zonesById.get(s.pickupFreeZoneId) : null
        const deliveryZone = s.deliveryFreeZoneId ? zonesById.get(s.deliveryFreeZoneId) : null
        return (
          <div key={s.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : s.id)}
              className="flex w-full items-start gap-4 p-4 text-start hover:bg-muted/30"
            >
              <span
                className={cn(
                  'mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1',
                  colors.ring,
                  colors.bg,
                )}
              >
                {s.complianceStatus === 'complete' ? (
                  <CheckCircle2 className={cn('h-4 w-4', colors.text)} />
                ) : s.complianceStatus === 'missing' ? (
                  <AlertTriangle className={cn('h-4 w-4', colors.text)} />
                ) : s.complianceStatus === 'partial' ? (
                  <Clock className={cn('h-4 w-4', colors.text)} />
                ) : (
                  <CircleDashed className={cn('h-4 w-4', colors.text)} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{s.reference}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                      colors.ring,
                      colors.bg,
                      colors.text,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                    {t(`compliance.${s.complianceStatus}`)}
                    {s.requiredCount > 0 && (
                      <span className="ms-0.5 tabular-nums">
                        ({s.uploadedCount}/{s.requiredCount})
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.clientName} · {s.pickupCity} → {s.deliveryCity}
                </p>
                {(pickupZone || deliveryZone) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pickupZone && (
                      <span className="me-2">
                        {t('zoneLabels.pickup')}: <strong>{pickupZone.code}</strong>
                      </span>
                    )}
                    {deliveryZone && (
                      <span>
                        {t('zoneLabels.delivery')}: <strong>{deliveryZone.code}</strong>
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(s.deliveryScheduledAt, locale)}
              </span>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/10 p-4">
                {s.requiredDocumentTypeIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('noRequirement')}</p>
                ) : (
                  <ul className="space-y-2">
                    {s.requiredDocumentTypeIds
                      .map((id) => docTypesById.get(id))
                      .filter((d): d is DocumentTypeVm => !!d)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((d) => {
                        const matches = s.uploaded.filter((u) => u.documentTypeId === d.id)
                        const present = matches.length > 0
                        return (
                          <li
                            key={d.id}
                            className="rounded-lg border bg-card p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-semibold">
                                  {present ? (
                                    <FileCheck className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <FileWarning className="h-4 w-4 text-rose-600" />
                                  )}
                                  <span className="font-mono text-xs uppercase tracking-wide">
                                    {d.code}
                                  </span>
                                  <span className="font-medium">{d.name}</span>
                                </p>
                                {d.description && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {d.description}
                                  </p>
                                )}
                              </div>
                              {canEdit && (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => onUpload(s, d.id)}
                                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  {t('actions.upload')}
                                </button>
                              )}
                            </div>

                            {matches.length > 0 && (
                              <ul className="mt-2 space-y-1.5">
                                {matches.map((u) => (
                                  <li
                                    key={u.id}
                                    className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{u.fileName}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {u.documentNumber ? `N° ${u.documentNumber} · ` : ''}
                                        {u.documentDate ? formatDate(u.documentDate, locale) + ' · ' : ''}
                                        {formatBytes(u.fileSizeBytes)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        title={t('actions.view')}
                                        disabled={isPending}
                                        onClick={() => onView(u.id)}
                                        className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                      </button>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          title={t('actions.delete')}
                                          disabled={isPending}
                                          onClick={() => onDelete(u.id)}
                                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
function ZonesGrid({
  zones,
  docTypesById,
}: {
  zones: ZoneVm[]
  docTypesById: Map<string, DocumentTypeVm>
}) {
  const t = useTranslations('freeZones')

  if (zones.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <Globe2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty.zones')}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {zones.map((z) => (
        <div
          key={z.id}
          className={cn(
            'rounded-xl border bg-card p-4 shadow-soft',
            !z.isActive && 'opacity-60',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs uppercase text-muted-foreground">{z.code}</p>
              <h3 className="text-base font-bold">{z.name}</h3>
              <p className="text-xs text-muted-foreground">
                {z.city}
                {z.country !== 'MA' ? `, ${z.country}` : ''}
                {z.customsOfficeCode ? ` · ${t('customsOffice')}: ${z.customsOfficeCode}` : ''}
              </p>
            </div>
          </div>

          {z.notes && <p className="mt-2 text-xs text-muted-foreground">{z.notes}</p>}

          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              {t('requiredChecklist')}
            </p>
            {z.requiredDocumentTypeIds.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('noRequirement')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {z.requiredDocumentTypeIds
                  .map((id) => docTypesById.get(id))
                  .filter((d): d is DocumentTypeVm => !!d)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 font-mono text-[11px] uppercase"
                      title={d.name}
                    >
                      {d.code}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
function RequirementMatrix({
  zones,
  documentTypes,
  canEdit,
  isPending,
  onToggle,
}: {
  zones: ZoneVm[]
  documentTypes: DocumentTypeVm[]
  canEdit: boolean
  isPending: boolean
  onToggle: (zoneId: string, docTypeId: string, isRequired: boolean) => void
}) {
  const t = useTranslations('freeZones')

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('table.zone')}</th>
              {documentTypes.map((d) => (
                <th key={d.id} className="px-3 py-3 text-center font-semibold" title={d.name}>
                  <span className="font-mono">{d.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {zones.map((z) => {
              const required = new Set(z.requiredDocumentTypeIds)
              return (
                <tr key={z.id} className={cn(!z.isActive && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs uppercase">{z.code}</p>
                    <p className="text-xs text-muted-foreground">{z.name}</p>
                  </td>
                  {documentTypes.map((d) => {
                    const isReq = required.has(d.id)
                    return (
                      <td key={d.id} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          disabled={!canEdit || isPending}
                          onClick={() => onToggle(z.id, d.id, !isReq)}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md transition',
                            isReq
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'border bg-background text-muted-foreground hover:bg-muted',
                            !canEdit && 'cursor-not-allowed',
                          )}
                          aria-label={isReq ? t('actions.removeRequirement') : t('actions.addRequirement')}
                        >
                          {isReq ? <CheckCircle2 className="h-3.5 w-3.5" /> : '·'}
                        </button>
                      </td>
                    )
                  })}
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
function UploadDialog({
  shipment,
  documentType,
  onClose,
  onSubmit,
}: {
  shipment: ZoneShipmentVm
  documentType: DocumentTypeVm
  onClose: () => void
  onSubmit: (data: {
    file: File
    documentNumber: string
    documentDate: string
    notes: string
  }) => Promise<boolean>
}) {
  const t = useTranslations('freeZones')
  const [file, setFile] = useState<File | null>(null)
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentDate, setDocumentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    const ok = await onSubmit({ file, documentNumber, documentDate, notes })
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
            <h2 className="text-lg font-bold">
              {t('dialog.uploadTitle', { code: documentType.code })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {documentType.name} · {shipment.reference}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t('dialog.file')}</span>
            <input
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">{t('dialog.fileHint')}</p>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">{t('dialog.documentNumber')}</span>
              <input
                type="text"
                maxLength={80}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={documentType.code === 'DUM' ? 'DUM-2026-XXXXX' : ''}
                className="w-full rounded-md border px-3 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">{t('dialog.documentDate')}</span>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t('dialog.notes')}</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </label>

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
              disabled={!file || submitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('actions.upload')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
