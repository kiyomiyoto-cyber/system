'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  X,
  Save,
  Send,
  FileText,
  Star,
  StarOff,
  TrendingUp,
  Handshake,
  Package,
  Mail,
  MessageCircle,
  Search,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
  createSubcontractedMission,
  updateSubcontractedMission,
  setMissionStatus,
  generateMissionOrderPdf,
  getMissionOrderSignedUrl,
  sendMissionOrder,
  type SubcontractorInput,
  type MissionInput,
} from '@/actions/subcontractors'

type VehicleType = 'motorcycle' | 'van' | 'truck' | 'pickup'
const VEHICLE_TYPES: VehicleType[] = ['motorcycle', 'van', 'truck', 'pickup']

export type MissionStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface SubcontractorVm {
  id: string
  name: string
  legalForm: string | null
  ice: string | null
  rcNumber: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  whatsappPhone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  vehicleTypes: VehicleType[]
  serviceAreas: string[]
  capacityKg: number | null
  rating: number | null
  bankName: string | null
  bankIban: string | null
  paymentTermsDays: number
  notes: string | null
  isActive: boolean
}

export interface MissionVm {
  id: string
  missionOrderNumber: string
  costExclTax: number
  saleExclTax: number
  marginExclTax: number
  marginPct: number
  status: MissionStatus
  sentAt: string | null
  sentVia: string | null
  sentTo: string | null
  hasPdf: boolean
  notes: string | null
  internalNotes: string | null
  createdAt: string
  subcontractorId: string
  subcontractorName: string
  shipmentId: string
  shipmentReference: string
  pickupCity: string
  deliveryCity: string
  clientName: string
}

export interface ShipmentOption {
  id: string
  reference: string
  pickupCity: string
  deliveryCity: string
  clientName: string
  priceExclTax: number | null
}

interface ViewProps {
  subcontractors: SubcontractorVm[]
  missions: MissionVm[]
  availableShipments: ShipmentOption[]
  canEdit: boolean
}

type TabKey = 'missions' | 'partners'

function formatCurrency(amount: number, locale: string): string {
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

const STATUS_COLORS: Record<MissionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  sent: 'bg-blue-100 text-blue-700 ring-blue-200',
  accepted: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  in_progress: 'bg-amber-100 text-amber-700 ring-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 ring-rose-200',
}

export function SubcontractingView({
  subcontractors,
  missions,
  availableShipments,
  canEdit,
}: ViewProps) {
  const t = useTranslations('subcontracting')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<TabKey>('missions')
  const [search, setSearch] = useState('')

  const [editingPartner, setEditingPartner] = useState<SubcontractorVm | null>(null)
  const [creatingPartner, setCreatingPartner] = useState(false)
  const [creatingMission, setCreatingMission] = useState(false)
  const [editingMission, setEditingMission] = useState<MissionVm | null>(null)
  const [sendingMission, setSendingMission] = useState<MissionVm | null>(null)

  const activeSubs = subcontractors.filter((s) => s.isActive)
  const totalMargin = missions
    .filter((m) => m.status !== 'cancelled')
    .reduce((sum, m) => sum + m.marginExclTax, 0)
  const totalCost = missions
    .filter((m) => m.status !== 'cancelled')
    .reduce((sum, m) => sum + m.costExclTax, 0)
  const inProgressCount = missions.filter(
    (m) => m.status === 'sent' || m.status === 'accepted' || m.status === 'in_progress',
  ).length

  const filteredMissions = useMemo(() => {
    if (!search.trim()) return missions
    const q = search.trim().toLowerCase()
    return missions.filter(
      (m) =>
        m.missionOrderNumber.toLowerCase().includes(q) ||
        m.shipmentReference.toLowerCase().includes(q) ||
        m.subcontractorName.toLowerCase().includes(q) ||
        m.clientName.toLowerCase().includes(q) ||
        m.pickupCity.toLowerCase().includes(q) ||
        m.deliveryCity.toLowerCase().includes(q),
    )
  }, [missions, search])

  const filteredPartners = useMemo(() => {
    if (!search.trim()) return subcontractors
    const q = search.trim().toLowerCase()
    return subcontractors.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.ice?.includes(q),
    )
  }, [subcontractors, search])

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('stats.activePartners')}
          value={`${activeSubs.length}`}
          subtitle={t('stats.outOfTotal', { total: subcontractors.length })}
          icon={Handshake}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
        />
        <KpiCard
          label={t('stats.openMissions')}
          value={`${inProgressCount}`}
          subtitle={t('stats.openMissionsSubtitle')}
          icon={Package}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <KpiCard
          label={t('stats.totalCost')}
          value={formatCurrency(totalCost, locale)}
          subtitle={t('stats.totalCostSubtitle', { count: missions.length })}
          icon={Send}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <KpiCard
          label={t('stats.totalMargin')}
          value={formatCurrency(totalMargin, locale)}
          subtitle={
            totalCost > 0
              ? t('stats.totalMarginPct', {
                  pct: ((totalMargin / (totalCost + totalMargin)) * 100).toFixed(1),
                })
              : t('stats.totalMarginEmpty')
          }
          icon={TrendingUp}
          iconColor={totalMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          iconBg={totalMargin >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}
        />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-background p-0.5">
              {(['missions', 'partners'] as TabKey[]).map((k) => (
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
                    {k === 'missions' ? missions.length : subcontractors.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="h-9 w-64 rounded-lg border bg-background ps-8 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {tab === 'missions' && (
                <button
                  type="button"
                  disabled={availableShipments.length === 0 || isPending}
                  onClick={() => setCreatingMission(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {t('actions.newMission')}
                </button>
              )}
              {tab === 'partners' && (
                <button
                  type="button"
                  onClick={() => setCreatingPartner(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {t('actions.newPartner')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {tab === 'missions' ? (
        <MissionsTable
          missions={filteredMissions}
          canEdit={canEdit}
          isPending={isPending}
          onEdit={(m) => setEditingMission(m)}
          onSend={(m) => setSendingMission(m)}
          onGeneratePdf={(m) => {
            startTransition(async () => {
              const r = await generateMissionOrderPdf(m.id)
              if (r.error) toast.error(r.error)
              else {
                toast.success(t('toast.pdfGenerated'))
                refresh()
              }
            })
          }}
          onDownload={(m) => {
            startTransition(async () => {
              const r = await getMissionOrderSignedUrl(m.id)
              if (r.error || !r.data) toast.error(r.error ?? '—')
              else window.open(r.data.url, '_blank', 'noopener,noreferrer')
            })
          }}
          onSetStatus={(m, s) => {
            startTransition(async () => {
              const r = await setMissionStatus(m.id, s)
              if (r.error) toast.error(r.error)
              else {
                toast.success(t(`toast.status.${s}`))
                refresh()
              }
            })
          }}
        />
      ) : (
        <PartnersGrid
          partners={filteredPartners}
          canEdit={canEdit}
          isPending={isPending}
          onEdit={(p) => setEditingPartner(p)}
          onDelete={(p) => {
            if (!confirm(t('confirmDelete', { name: p.name }))) return
            startTransition(async () => {
              const r = await deleteSubcontractor(p.id)
              if (r.error) toast.error(r.error)
              else {
                toast.success(t('toast.partnerDeleted'))
                refresh()
              }
            })
          }}
        />
      )}

      {(creatingPartner || editingPartner) && (
        <PartnerDialog
          partner={editingPartner}
          onClose={() => {
            setCreatingPartner(false)
            setEditingPartner(null)
          }}
          onSubmit={(data) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const result = editingPartner
                  ? await updateSubcontractor(editingPartner.id, data)
                  : await createSubcontractor(data)
                if (result.error) {
                  toast.error(result.error)
                  resolve(false)
                  return
                }
                toast.success(editingPartner ? t('toast.partnerUpdated') : t('toast.partnerCreated'))
                refresh()
                resolve(true)
              })
            })
          }
        />
      )}

      {creatingMission && (
        <MissionDialog
          mission={null}
          partners={activeSubs}
          shipments={availableShipments}
          onClose={() => setCreatingMission(false)}
          onSubmit={(data) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await createSubcontractedMission(data as MissionInput)
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(t('toast.missionCreated', { number: r.data?.missionOrderNumber ?? '' }))
                refresh()
                resolve(true)
              })
            })
          }
        />
      )}

      {editingMission && (
        <EditMissionDialog
          mission={editingMission}
          onClose={() => setEditingMission(null)}
          onSubmit={(data) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await updateSubcontractedMission(editingMission.id, data)
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(t('toast.missionUpdated'))
                refresh()
                resolve(true)
              })
            })
          }
        />
      )}

      {sendingMission && (
        <SendMissionDialog
          mission={sendingMission}
          partner={subcontractors.find((s) => s.id === sendingMission.subcontractorId) ?? null}
          onClose={() => setSendingMission(null)}
          onSubmit={(via, to) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const r = await sendMissionOrder(sendingMission.id, { via, to })
                if (r.error) {
                  toast.error(r.error)
                  resolve(false)
                  return
                }
                toast.success(t('toast.missionSent'))
                refresh()
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
// KPI card
// ============================================================
function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Missions table
// ============================================================
function MissionsTable({
  missions,
  canEdit,
  isPending,
  onEdit,
  onSend,
  onGeneratePdf,
  onDownload,
  onSetStatus,
}: {
  missions: MissionVm[]
  canEdit: boolean
  isPending: boolean
  onEdit: (m: MissionVm) => void
  onSend: (m: MissionVm) => void
  onGeneratePdf: (m: MissionVm) => void
  onDownload: (m: MissionVm) => void
  onSetStatus: (
    m: MissionVm,
    s: 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled',
  ) => void
}) {
  const t = useTranslations('subcontracting')
  const locale = useLocale()

  if (missions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty.missions')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('table.missionOrder')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.shipment')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.partner')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.cost')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.sale')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.margin')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('table.status')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {missions.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-semibold">{m.missionOrderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-semibold">{m.shipmentReference}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{m.pickupCity}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{m.deliveryCity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{m.clientName}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{m.subcontractorName}</p>
                  {m.sentAt && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {m.sentVia === 'email' ? (
                        <Mail className="h-3 w-3" />
                      ) : m.sentVia === 'whatsapp' ? (
                        <MessageCircle className="h-3 w-3" />
                      ) : null}
                      {t('table.sentOn', { date: formatDate(m.sentAt, locale) })}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-end font-mono text-sm tabular-nums">
                  {formatCurrency(m.costExclTax, locale)}
                </td>
                <td className="px-4 py-3 text-end font-mono text-sm tabular-nums text-muted-foreground">
                  {formatCurrency(m.saleExclTax, locale)}
                </td>
                <td className="px-4 py-3 text-end font-mono text-sm tabular-nums">
                  <span
                    className={cn(
                      'font-semibold',
                      m.marginExclTax > 0
                        ? 'text-emerald-700'
                        : m.marginExclTax < 0
                          ? 'text-rose-700'
                          : 'text-muted-foreground',
                    )}
                  >
                    {formatCurrency(m.marginExclTax, locale)}
                  </span>
                  <span className="ms-1 text-xs text-muted-foreground">
                    ({m.marginPct.toFixed(1)}%)
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                      STATUS_COLORS[m.status],
                    )}
                  >
                    {t(`status.${m.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {m.hasPdf ? (
                      <button
                        type="button"
                        title={t('actions.viewPdf')}
                        disabled={isPending}
                        onClick={() => onDownload(m)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    ) : (
                      canEdit && (
                        <button
                          type="button"
                          title={t('actions.generatePdf')}
                          disabled={isPending}
                          onClick={() => onGeneratePdf(m)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )
                    )}
                    {canEdit && m.status !== 'completed' && m.status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          title={t('actions.send')}
                          disabled={isPending}
                          onClick={() => onSend(m)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title={t('actions.edit')}
                          disabled={isPending}
                          onClick={() => onEdit(m)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {canEdit && (
                      <StatusMenu
                        mission={m}
                        isPending={isPending}
                        onSelect={(s) => onSetStatus(m, s)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusMenu({
  mission,
  isPending,
  onSelect,
}: {
  mission: MissionVm
  isPending: boolean
  onSelect: (s: 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled') => void
}) {
  const t = useTranslations('subcontracting')
  const transitions: Record<MissionStatus, Array<'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'>> = {
    draft: ['sent', 'cancelled'],
    sent: ['accepted', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }
  const allowed = transitions[mission.status]
  if (allowed.length === 0) return null
  return (
    <div className="relative">
      <select
        disabled={isPending}
        value=""
        onChange={(e) => {
          const v = e.target.value as 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | ''
          if (v) onSelect(v)
        }}
        className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
      >
        <option value="">{t('actions.changeStatus')}</option>
        {allowed.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============================================================
// Partners grid
// ============================================================
function PartnersGrid({
  partners,
  canEdit,
  isPending,
  onEdit,
  onDelete,
}: {
  partners: SubcontractorVm[]
  canEdit: boolean
  isPending: boolean
  onEdit: (p: SubcontractorVm) => void
  onDelete: (p: SubcontractorVm) => void
}) {
  const t = useTranslations('subcontracting')

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <Handshake className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty.partners')}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {partners.map((p) => (
        <div
          key={p.id}
          className={cn(
            'rounded-xl border bg-card p-4 shadow-soft transition hover:shadow-soft-md',
            !p.isActive && 'opacity-60',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold">{p.name}</h3>
              {p.legalForm && (
                <p className="mt-0.5 text-xs text-muted-foreground">{p.legalForm}</p>
              )}
              {p.city && <p className="mt-0.5 text-xs text-muted-foreground">{p.city}</p>}
            </div>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) =>
                p.rating && n <= p.rating ? (
                  <Star
                    key={n}
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  />
                ) : (
                  <StarOff key={n} className="h-3.5 w-3.5 text-muted-foreground/30" />
                ),
              )}
            </div>
          </div>

          {(p.contactName || p.contactPhone) && (
            <div className="mt-3 space-y-0.5 text-xs">
              {p.contactName && <p className="font-medium">{p.contactName}</p>}
              {p.contactPhone && <p className="text-muted-foreground">{p.contactPhone}</p>}
              {p.contactEmail && <p className="text-muted-foreground">{p.contactEmail}</p>}
            </div>
          )}

          {p.vehicleTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {p.vehicleTypes.map((v) => (
                <span
                  key={v}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {t(`vehicleType.${v}`)}
                </span>
              ))}
            </div>
          )}

          {p.serviceAreas.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {p.serviceAreas.join(' · ')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
            {p.ice && <span>ICE: {p.ice}</span>}
            <span>{t('partner.paymentTerms', { days: p.paymentTermsDays })}</span>
          </div>

          {canEdit && (
            <div className="mt-3 flex items-center justify-end gap-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => onEdit(p)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t('actions.edit')}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onDelete(p)}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Partner dialog
// ============================================================
function PartnerDialog({
  partner,
  onClose,
  onSubmit,
}: {
  partner: SubcontractorVm | null
  onClose: () => void
  onSubmit: (data: SubcontractorInput) => Promise<boolean>
}) {
  const t = useTranslations('subcontracting')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<SubcontractorInput>({
    name: partner?.name ?? '',
    legalForm: partner?.legalForm ?? '',
    ice: partner?.ice ?? '',
    rcNumber: partner?.rcNumber ?? '',
    contactName: partner?.contactName ?? '',
    contactPhone: partner?.contactPhone ?? '',
    contactEmail: partner?.contactEmail ?? '',
    whatsappPhone: partner?.whatsappPhone ?? '',
    address: partner?.address ?? '',
    city: partner?.city ?? '',
    postalCode: partner?.postalCode ?? '',
    vehicleTypes: partner?.vehicleTypes ?? [],
    serviceAreas: partner?.serviceAreas ?? [],
    capacityKg: partner?.capacityKg ?? null,
    rating: partner?.rating ?? null,
    bankName: partner?.bankName ?? '',
    bankIban: partner?.bankIban ?? '',
    paymentTermsDays: partner?.paymentTermsDays ?? 30,
    notes: partner?.notes ?? '',
    isActive: partner?.isActive ?? true,
  })

  const [serviceAreasInput, setServiceAreasInput] = useState(
    (partner?.serviceAreas ?? []).join(', '),
  )

  function toggleVehicle(v: VehicleType) {
    setForm((f) => {
      const cur = f.vehicleTypes ?? []
      const has = cur.includes(v)
      return { ...f, vehicleTypes: has ? cur.filter((x) => x !== v) : [...cur, v] }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const areas = serviceAreasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const ok = await onSubmit({ ...form, serviceAreas: areas })
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <DialogShell title={partner ? t('dialog.editPartner') : t('dialog.newPartner')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dialog.name')} required>
            <input
              type="text"
              required
              maxLength={160}
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label={t('dialog.legalForm')}>
            <input
              type="text"
              maxLength={40}
              value={form.legalForm ?? ''}
              onChange={(e) => setForm({ ...form, legalForm: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.ice')} hint={t('dialog.iceHint')}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={15}
              value={form.ice ?? ''}
              onChange={(e) => setForm({ ...form, ice: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 font-mono text-sm"
            />
          </Field>
          <Field label={t('dialog.rcNumber')}>
            <input
              type="text"
              maxLength={40}
              value={form.rcNumber ?? ''}
              onChange={(e) => setForm({ ...form, rcNumber: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.contactName')}>
            <input
              type="text"
              maxLength={120}
              value={form.contactName ?? ''}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.contactPhone')}>
            <input
              type="tel"
              maxLength={40}
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.contactEmail')}>
            <input
              type="email"
              maxLength={160}
              value={form.contactEmail ?? ''}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.whatsappPhone')}>
            <input
              type="tel"
              maxLength={40}
              value={form.whatsappPhone ?? ''}
              onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.address')}>
            <input
              type="text"
              maxLength={255}
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.city')}>
            <input
              type="text"
              maxLength={80}
              value={form.city ?? ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
        </div>

        <Field label={t('dialog.vehicleTypes')}>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((v) => {
              const on = form.vehicleTypes?.includes(v) ?? false
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVehicle(v)}
                  className={cn(
                    'rounded-md border px-3 py-1 text-xs font-medium transition',
                    on
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'bg-background hover:bg-muted',
                  )}
                >
                  {t(`vehicleType.${v}`)}
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          label={t('dialog.serviceAreas')}
          hint={t('dialog.serviceAreasHint')}
        >
          <input
            type="text"
            value={serviceAreasInput}
            onChange={(e) => setServiceAreasInput(e.target.value)}
            placeholder="Tanger, Kénitra, Casablanca"
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('dialog.capacityKg')}>
            <input
              type="number"
              min="0"
              step="100"
              value={form.capacityKg ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  capacityKg: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.rating')}>
            <select
              value={form.rating ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  rating: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {'★'.repeat(n)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('dialog.paymentTermsDays')}>
            <input
              type="number"
              min="0"
              max="180"
              value={form.paymentTermsDays ?? 30}
              onChange={(e) =>
                setForm({ ...form, paymentTermsDays: Number(e.target.value) })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dialog.bankName')}>
            <input
              type="text"
              maxLength={120}
              value={form.bankName ?? ''}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('dialog.bankIban')}>
            <input
              type="text"
              maxLength={40}
              value={form.bankIban ?? ''}
              onChange={(e) => setForm({ ...form, bankIban: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 font-mono text-sm"
            />
          </Field>
        </div>

        <Field label={t('dialog.notes')}>
          <textarea
            rows={2}
            maxLength={1000}
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive ?? true}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="rounded border-muted-foreground/30"
          />
          {t('dialog.isActive')}
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
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('actions.save')}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

// ============================================================
// Mission dialog (create)
// ============================================================
function MissionDialog({
  partners,
  shipments,
  onClose,
  onSubmit,
}: {
  mission: null
  partners: SubcontractorVm[]
  shipments: ShipmentOption[]
  onClose: () => void
  onSubmit: (data: MissionInput) => Promise<boolean>
}) {
  const t = useTranslations('subcontracting')
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<MissionInput>({
    shipmentId: shipments[0]?.id ?? '',
    subcontractorId: partners[0]?.id ?? '',
    costExclTax: 0,
    notes: '',
    internalNotes: '',
  })

  const selectedShipment = useMemo(
    () => shipments.find((s) => s.id === form.shipmentId),
    [form.shipmentId, shipments],
  )
  const sale = selectedShipment?.priceExclTax ?? 0
  const margin = sale - Number(form.costExclTax || 0)
  const marginPct = sale > 0 ? (margin / sale) * 100 : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.shipmentId || !form.subcontractorId) {
      toast.error(t('dialog.missionRequiredFields'))
      return
    }
    setSubmitting(true)
    const ok = await onSubmit(form)
    setSubmitting(false)
    if (ok) onClose()
  }

  if (partners.length === 0) {
    return (
      <DialogShell title={t('dialog.newMission')} onClose={onClose}>
        <p className="text-sm text-muted-foreground">{t('dialog.noPartners')}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted"
          >
            {t('actions.close')}
          </button>
        </div>
      </DialogShell>
    )
  }

  return (
    <DialogShell title={t('dialog.newMission')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('dialog.shipment')} required>
          <select
            required
            value={form.shipmentId}
            onChange={(e) => setForm({ ...form, shipmentId: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference} — {s.clientName} ({s.pickupCity} → {s.deliveryCity})
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('dialog.partner')} required>
          <select
            required
            value={form.subcontractorId}
            onChange={(e) => setForm({ ...form, subcontractorId: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.rating ? ` · ${'★'.repeat(p.rating)}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t('dialog.salePrice')}</p>
              <p className="font-mono font-semibold">{formatCurrency(sale, locale)}</p>
            </div>
            <Field label={t('dialog.cost')}>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.costExclTax ?? 0}
                onChange={(e) => setForm({ ...form, costExclTax: Number(e.target.value) })}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </Field>
            <div>
              <p className="text-xs text-muted-foreground">{t('dialog.estimatedMargin')}</p>
              <p
                className={cn(
                  'font-mono font-semibold',
                  margin > 0 ? 'text-emerald-700' : margin < 0 ? 'text-rose-700' : '',
                )}
              >
                {formatCurrency(margin, locale)}
                <span className="ms-1 text-xs">({marginPct.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>

        <Field label={t('dialog.notes')} hint={t('dialog.notesHint')}>
          <textarea
            rows={2}
            maxLength={1000}
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

        <Field label={t('dialog.internalNotes')} hint={t('dialog.internalNotesHint')}>
          <textarea
            rows={2}
            maxLength={1000}
            value={form.internalNotes ?? ''}
            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

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
            disabled={submitting}
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

// ============================================================
// Edit mission dialog (cost + notes only)
// ============================================================
function EditMissionDialog({
  mission,
  onClose,
  onSubmit,
}: {
  mission: MissionVm
  onClose: () => void
  onSubmit: (data: { costExclTax: number; notes: string | null; internalNotes: string | null }) => Promise<boolean>
}) {
  const t = useTranslations('subcontracting')
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)
  const [cost, setCost] = useState<number>(mission.costExclTax)
  const [notes, setNotes] = useState<string>(mission.notes ?? '')
  const [internalNotes, setInternalNotes] = useState<string>(mission.internalNotes ?? '')

  const margin = mission.saleExclTax - cost
  const marginPct = mission.saleExclTax > 0 ? (margin / mission.saleExclTax) * 100 : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const ok = await onSubmit({ costExclTax: cost, notes: notes || null, internalNotes: internalNotes || null })
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <DialogShell title={t('dialog.editMission', { number: mission.missionOrderNumber })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>{t('dialog.editMissionShipment', { ref: mission.shipmentReference })}</p>
          <p>{mission.subcontractorName}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('dialog.salePrice')}</p>
            <p className="font-mono font-semibold">{formatCurrency(mission.saleExclTax, locale)}</p>
          </div>
          <Field label={t('dialog.cost')}>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <div>
            <p className="text-xs text-muted-foreground">{t('dialog.estimatedMargin')}</p>
            <p
              className={cn(
                'font-mono font-semibold',
                margin > 0 ? 'text-emerald-700' : margin < 0 ? 'text-rose-700' : '',
              )}
            >
              {formatCurrency(margin, locale)}
              <span className="ms-1 text-xs">({marginPct.toFixed(1)}%)</span>
            </p>
          </div>
        </div>

        <Field label={t('dialog.notes')}>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t('dialog.internalNotes')}>
          <textarea
            rows={2}
            maxLength={1000}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

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
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('actions.save')}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

// ============================================================
// Send mission dialog
// ============================================================
function SendMissionDialog({
  mission,
  partner,
  onClose,
  onSubmit,
}: {
  mission: MissionVm
  partner: SubcontractorVm | null
  onClose: () => void
  onSubmit: (via: 'email' | 'whatsapp', to: string) => Promise<boolean>
}) {
  const t = useTranslations('subcontracting')
  const [submitting, setSubmitting] = useState(false)
  const [via, setVia] = useState<'email' | 'whatsapp'>(
    partner?.contactEmail ? 'email' : partner?.whatsappPhone ? 'whatsapp' : 'email',
  )
  const [to, setTo] = useState<string>(
    via === 'email' ? (partner?.contactEmail ?? '') : (partner?.whatsappPhone ?? partner?.contactPhone ?? ''),
  )

  function changeVia(v: 'email' | 'whatsapp') {
    setVia(v)
    setTo(v === 'email' ? (partner?.contactEmail ?? '') : (partner?.whatsappPhone ?? partner?.contactPhone ?? ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!to.trim()) return
    setSubmitting(true)
    const ok = await onSubmit(via, to.trim())
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <DialogShell title={t('dialog.sendTitle', { number: mission.missionOrderNumber })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('dialog.sendDescription')}</p>

        <Field label={t('dialog.channel')}>
          <div className="flex rounded-lg border bg-background p-0.5">
            {(['email', 'whatsapp'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => changeVia(v)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  via === v
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'email' ? <Mail className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {t(`dialog.channelOptions.${v}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={via === 'email' ? t('dialog.emailRecipient') : t('dialog.whatsappRecipient')} required>
          <input
            type={via === 'email' ? 'email' : 'tel'}
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={via === 'email' ? 'partenaire@example.com' : '+212 6XX XX XX XX'}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </Field>

        {via === 'whatsapp' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {t('dialog.whatsappWarning')}
          </div>
        )}

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
            disabled={submitting || !to.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('actions.send')}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

// ============================================================
// Reusable bits
// ============================================================
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
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  )
}
