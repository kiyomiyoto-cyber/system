'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Loader2,
  Plus,
  Save,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMAD } from '@/lib/utils/formatters'
import {
  recordTollTransaction,
  upsertVehiclePass,
  upsertVignette,
  type PassProvider,
  type TollKind,
  type TollTransactionRow,
  type VehiclePassRow,
  type VignetteKind,
  type VignetteRow,
} from '@/actions/fleet-passes'

export interface VehicleOption {
  id: string
  plate: string
  isActive: boolean
}

interface ViewProps {
  passes: VehiclePassRow[]
  tolls: TollTransactionRow[]
  vignettes: VignetteRow[]
  vehicles: VehicleOption[]
  locale: string
}

const VIGNETTE_KINDS: VignetteKind[] = [
  'annual',
  'technical_inspection',
  'insurance',
  'tax_disc',
  'other',
]

type Tab = 'passes' | 'tolls' | 'vignettes'

export function MacaronsPeagesView({
  passes,
  tolls,
  vignettes,
  vehicles,
  locale,
}: ViewProps) {
  const t = useTranslations('macaronsPeages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('passes')
  const [creatingPass, setCreatingPass] = useState(false)
  const [editingPass, setEditingPass] = useState<VehiclePassRow | null>(null)
  const [recordingToll, setRecordingToll] = useState<VehiclePassRow | null>(null)
  const [creatingVignette, setCreatingVignette] = useState(false)
  const [editingVignette, setEditingVignette] = useState<VignetteRow | null>(null)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('passes')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'passes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.passes', { count: passes.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('tolls')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'tolls'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.tolls', { count: tolls.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('vignettes')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'vignettes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.vignettes', { count: vignettes.length })}
        </button>
        <div className="ms-auto flex items-center gap-2">
          {tab === 'passes' && vehicles.length > 0 && (
            <button
              type="button"
              onClick={() => setCreatingPass(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-ring"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('actions.newPass')}
            </button>
          )}
          {tab === 'vignettes' && vehicles.length > 0 && (
            <button
              type="button"
              onClick={() => setCreatingVignette(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-ring"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('actions.newVignette')}
            </button>
          )}
        </div>
      </div>

      {tab === 'passes' &&
        (passes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            {t('passes.empty')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {passes.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl border bg-card p-4 shadow-soft',
                  p.isLowBalance && 'ring-2 ring-amber-300',
                  !p.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <h3 className="truncate text-sm font-bold text-foreground">
                        {p.vehiclePlate ?? '—'}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`provider.${p.provider}`)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-foreground">{p.tagNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPass(p)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2">
                  <span
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      p.isLowBalance ? 'text-amber-700' : 'text-foreground',
                    )}
                  >
                    {formatMAD(p.currentBalanceMad)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecordingToll(p)}
                    className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1 text-[10px] font-semibold hover:bg-muted focus-ring"
                  >
                    <Wallet className="h-3 w-3" />
                    {t('actions.recordToll')}
                  </button>
                </div>
                {p.isLowBalance && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    {t('passes.lowBalanceLabel', { threshold: formatMAD(p.lowBalanceThresholdMad) })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}

      {tab === 'tolls' &&
        (tolls.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            {t('tolls.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th>{t('tolls.col.date')}</Th>
                  <Th>{t('tolls.col.vehicle')}</Th>
                  <Th>{t('tolls.col.kind')}</Th>
                  <Th>{t('tolls.col.station')}</Th>
                  <Th align="end">{t('tolls.col.amount')}</Th>
                  <Th>{t('tolls.col.reference')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tolls.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {new Date(row.occurredAt).toLocaleString('fr-MA', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2 text-xs">{row.vehiclePlate ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">{t(`tollKind.${row.kind}`)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.station ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-end font-mono text-xs font-semibold',
                        row.amountMad < 0 ? 'text-rose-700' : 'text-emerald-700',
                      )}
                    >
                      {formatMAD(row.amountMad)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.reference ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'vignettes' &&
        (vignettes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            {t('vignettes.empty')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {vignettes.map((v) => {
              const isExpired = v.daysUntilExpiry < 0
              const isExpiringSoon = !isExpired && v.daysUntilExpiry <= 30
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setEditingVignette(v)}
                  className={cn(
                    'rounded-xl border bg-card p-4 text-start shadow-soft transition-colors hover:bg-muted/20 focus-ring',
                    isExpired && 'ring-2 ring-rose-300',
                    isExpiringSoon && 'ring-2 ring-amber-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold text-foreground">{v.vehiclePlate ?? '—'}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(`vignetteKind.${v.kind}`)}
                  </p>
                  <p className="mt-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {t('vignettes.expiresOn')}
                    </span>{' '}
                    {new Date(v.expiresAt).toLocaleDateString('fr-MA')}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[11px] font-semibold',
                      isExpired
                        ? 'text-rose-700'
                        : isExpiringSoon
                          ? 'text-amber-700'
                          : 'text-emerald-700',
                    )}
                  >
                    {isExpired
                      ? t('vignettes.expiredAgo', { days: Math.abs(v.daysUntilExpiry) })
                      : t('vignettes.daysLeft', { days: v.daysUntilExpiry })}
                  </p>
                  {v.amountMad != null && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {formatMAD(v.amountMad)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        ))}

      {(creatingPass || editingPass) && (
        <PassDialog
          pass={editingPass}
          vehicles={vehicles}
          onClose={() => {
            setCreatingPass(false)
            setEditingPass(null)
          }}
          onSaved={() => {
            setCreatingPass(false)
            setEditingPass(null)
            router.refresh()
          }}
        />
      )}
      {recordingToll && (
        <TollDialog
          pass={recordingToll}
          onClose={() => setRecordingToll(null)}
          onSaved={() => {
            setRecordingToll(null)
            router.refresh()
          }}
        />
      )}
      {(creatingVignette || editingVignette) && (
        <VignetteDialog
          vignette={editingVignette}
          vehicles={vehicles}
          onClose={() => {
            setCreatingVignette(false)
            setEditingVignette(null)
          }}
          onSaved={() => {
            setCreatingVignette(false)
            setEditingVignette(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function Th({ children, align = 'start' }: { children: React.ReactNode; align?: 'start' | 'end' }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
        align === 'end' ? 'text-end' : 'text-start',
      )}
    >
      {children}
    </th>
  )
}

function PassDialog({
  pass,
  vehicles,
  onClose,
  onSaved,
}: {
  pass: VehiclePassRow | null
  vehicles: VehicleOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('macaronsPeages.passDialog')
  const tProv = useTranslations('macaronsPeages.provider')
  const tCommon = useTranslations('common')
  const [vehicleId, setVehicleId] = useState(pass?.vehicleId ?? vehicles[0]?.id ?? '')
  const [provider, setProvider] = useState<PassProvider>(pass?.provider ?? 'jawaz')
  const [tagNumber, setTagNumber] = useState(pass?.tagNumber ?? '')
  const [threshold, setThreshold] = useState(String(pass?.lowBalanceThresholdMad ?? 100))
  const [isActive, setIsActive] = useState(pass?.isActive ?? true)
  const [isSaving, startSave] = useTransition()

  const valid = vehicleId && tagNumber.trim().length >= 1 && Number(threshold) >= 0

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await upsertVehiclePass({
          id: pass?.id,
          vehicleId,
          provider,
          tagNumber: tagNumber.trim(),
          lowBalanceThresholdMad: Number(threshold),
          isActive,
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(pass ? t('toast.updated') : t('toast.created'))
        onSaved()
      })()
    })
  }

  return (
    <DialogShell title={pass ? t('titleEdit') : t('titleNew')} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('field.vehicle')}>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('field.provider')}>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as PassProvider)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="jawaz">{tProv('jawaz')}</option>
            <option value="passplus">{tProv('passplus')}</option>
            <option value="autre">{tProv('autre')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('field.tagNumber')}>
        <input
          value={tagNumber}
          onChange={(e) => setTagNumber(e.target.value)}
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </Field>
      <Field label={t('field.threshold')}>
        <input
          type="number"
          min="0"
          step="10"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
        {t('field.isActive')}
      </label>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={tCommon('save')}
        confirmDisabled={!valid || isSaving}
        confirmIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      />
    </DialogShell>
  )
}

function TollDialog({
  pass,
  onClose,
  onSaved,
}: {
  pass: VehiclePassRow
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('macaronsPeages.tollDialog')
  const tKind = useTranslations('macaronsPeages.tollKind')
  const tCommon = useTranslations('common')
  const [kind, setKind] = useState<TollKind>('crossing')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16))
  const [station, setStation] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [isSaving, startSave] = useTransition()

  const valid = Number(amount) > 0 && occurredAt

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await recordTollTransaction({
          vehiclePassId: pass.id,
          vehicleId: pass.vehicleId,
          kind,
          occurredAt: new Date(occurredAt).toISOString(),
          station: station.trim() || null,
          amountMad: Number(amount),
          reference: reference.trim() || null,
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(t('toast.recorded'))
        onSaved()
      })()
    })
  }

  return (
    <DialogShell title={t('title')} onClose={onClose}>
      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="font-mono font-semibold text-primary">{pass.tagNumber}</p>
        <p className="mt-0.5 text-muted-foreground">{pass.vehiclePlate}</p>
        <p className="mt-1 font-mono text-[11px]">
          {t('currentBalance')}: <span className="font-semibold">{formatMAD(pass.currentBalanceMad)}</span>
        </p>
      </div>
      <Field label={t('field.kind')}>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TollKind)}
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          <option value="crossing">{tKind('crossing')}</option>
          <option value="top_up">{tKind('top_up')}</option>
          <option value="adjustment">{tKind('adjustment')}</option>
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('field.occurredAt')}>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
        <Field label={t('field.amount')}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
      </div>
      <Field label={t('field.station')}>
        <input
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder={t('field.stationPlaceholder')}
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </Field>
      <Field label={t('field.reference')}>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </Field>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={t('actions.confirm')}
        confirmDisabled={!valid || isSaving}
        confirmIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      />
    </DialogShell>
  )
}

function VignetteDialog({
  vignette,
  vehicles,
  onClose,
  onSaved,
}: {
  vignette: VignetteRow | null
  vehicles: VehicleOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('macaronsPeages.vignetteDialog')
  const tKind = useTranslations('macaronsPeages.vignetteKind')
  const tCommon = useTranslations('common')
  const [vehicleId, setVehicleId] = useState(vignette?.vehicleId ?? vehicles[0]?.id ?? '')
  const [kind, setKind] = useState<VignetteKind>(vignette?.kind ?? 'annual')
  const [reference, setReference] = useState(vignette?.reference ?? '')
  const [amountMad, setAmountMad] = useState(
    vignette?.amountMad != null ? String(vignette.amountMad) : '',
  )
  const [issuedAt, setIssuedAt] = useState(vignette?.issuedAt ?? new Date().toISOString().slice(0, 10))
  const [expiresAt, setExpiresAt] = useState(vignette?.expiresAt ?? '')
  const [isSaving, startSave] = useTransition()

  const valid = vehicleId && issuedAt && expiresAt

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await upsertVignette({
          id: vignette?.id,
          vehicleId,
          kind,
          reference: reference.trim() || null,
          amountMad: amountMad === '' ? null : Number(amountMad),
          issuedAt,
          expiresAt,
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(vignette ? t('toast.updated') : t('toast.created'))
        onSaved()
      })()
    })
  }

  return (
    <DialogShell title={vignette ? t('titleEdit') : t('titleNew')} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('field.vehicle')}>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('field.kind')}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as VignetteKind)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {VIGNETTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {tKind(k)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('field.issuedAt')}>
          <input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
        <Field label={t('field.expiresAt')}>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('field.reference')}>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
        <Field label={t('field.amount')}>
          <input
            type="number"
            step="0.01"
            value={amountMad}
            onChange={(e) => setAmountMad(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={tCommon('save')}
        confirmDisabled={!valid || isSaving}
        confirmIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      />
    </DialogShell>
  )
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const tCommon = useTranslations('common')
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function DialogFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  confirmIcon,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  confirmIcon?: React.ReactNode
}) {
  const tCommon = useTranslations('common')
  return (
    <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted focus-ring"
      >
        {tCommon('cancel')}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
          confirmDisabled
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {confirmIcon}
        {confirmLabel}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  )
}

