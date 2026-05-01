'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Trash2, Edit3, Loader2, X, Save } from 'lucide-react'
import {
  addPricingRule,
  updatePricingRule,
  deletePricingRule,
  type PricingRuleInput,
} from '@/actions/client-contracts'
import { formatMAD } from '@/lib/utils/formatters'

export interface PricingRuleViewModel {
  id: string
  routeLabel: string
  pickupCity: string | null
  deliveryCity: string | null
  vehicleType: 'motorcycle' | 'van' | 'truck' | 'pickup' | null
  basePriceMad: number
  surchargeNightPct: number
  surchargeWeekendPct: number
  surchargeUrgentPct: number
  surchargeWaitingPerHourMad: number
  customsZone: boolean
  notes: string | null
  isActive: boolean
  sortOrder: number
}

interface PricingGridEditorProps {
  contractId: string
  initialRules: PricingRuleViewModel[]
  canEdit: boolean
}

export function PricingGridEditor({ contractId, initialRules, canEdit }: PricingGridEditorProps) {
  const t = useTranslations('contracts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingRule, setEditingRule] = useState<PricingRuleViewModel | null>(null)
  const [creating, setCreating] = useState(false)

  function handleDelete(rule: PricingRuleViewModel) {
    if (!confirm(t('grid.confirmDelete', { route: rule.routeLabel }))) return
    startTransition(async () => {
      const result = await deletePricingRule(rule.id)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('grid.deleted'))
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">{t('grid.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('grid.subtitle')}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('grid.addRule')}
          </button>
        )}
      </div>

      {initialRules.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t('grid.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {initialRules.map((rule) => (
            <li key={rule.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-semibold text-foreground">{rule.routeLabel}</h3>
                    {rule.customsZone && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        {t('grid.customs')}
                      </span>
                    )}
                    {rule.vehicleType && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t(`vehicle.${rule.vehicleType}`)}
                      </span>
                    )}
                  </div>
                  {(rule.pickupCity || rule.deliveryCity) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {rule.pickupCity ?? '*'} → {rule.deliveryCity ?? '*'}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-base font-bold text-foreground">{formatMAD(rule.basePriceMad)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('grid.surchargeSummary', {
                      night: rule.surchargeNightPct,
                      weekend: rule.surchargeWeekendPct,
                      urgent: rule.surchargeUrgentPct,
                      waiting: formatMAD(rule.surchargeWaitingPerHourMad),
                    })}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingRule(rule)}
                      className="rounded-lg border bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={tCommon('edit')}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      disabled={isPending}
                      className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      aria-label={tCommon('delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editingRule) && (
        <RuleDialog
          contractId={contractId}
          rule={editingRule}
          onClose={() => {
            setCreating(false)
            setEditingRule(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditingRule(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

interface RuleDialogProps {
  contractId: string
  rule: PricingRuleViewModel | null
  onClose: () => void
  onSaved: () => void
}

function RuleDialog({ contractId, rule, onClose, onSaved }: RuleDialogProps) {
  const t = useTranslations('contracts')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const [routeLabel, setRouteLabel] = useState(rule?.routeLabel ?? '')
  const [pickupCity, setPickupCity] = useState(rule?.pickupCity ?? '')
  const [deliveryCity, setDeliveryCity] = useState(rule?.deliveryCity ?? '')
  const [vehicleType, setVehicleType] = useState<string>(rule?.vehicleType ?? '')
  const [basePriceMad, setBasePriceMad] = useState(String(rule?.basePriceMad ?? ''))
  const [night, setNight] = useState(String(rule?.surchargeNightPct ?? 30))
  const [weekend, setWeekend] = useState(String(rule?.surchargeWeekendPct ?? 50))
  const [urgent, setUrgent] = useState(String(rule?.surchargeUrgentPct ?? 25))
  const [waiting, setWaiting] = useState(String(rule?.surchargeWaitingPerHourMad ?? 0))
  const [customsZone, setCustomsZone] = useState(rule?.customsZone ?? false)
  const [notes, setNotes] = useState(rule?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (routeLabel.trim().length < 1) {
      toast.error(t('grid.routeRequired'))
      return
    }
    const payload: PricingRuleInput = {
      routeLabel: routeLabel.trim(),
      pickupCity: pickupCity.trim() || null,
      deliveryCity: deliveryCity.trim() || null,
      vehicleType: vehicleType === '' ? null : (vehicleType as 'motorcycle' | 'van' | 'truck' | 'pickup'),
      basePriceMad: Number(basePriceMad) || 0,
      surchargeNightPct: Number(night) || 0,
      surchargeWeekendPct: Number(weekend) || 0,
      surchargeUrgentPct: Number(urgent) || 0,
      surchargeWaitingPerHourMad: Number(waiting) || 0,
      customsZone,
      notes: notes.trim() || null,
    }
    startTransition(async () => {
      const result = rule
        ? await updatePricingRule(rule.id, payload)
        : await addPricingRule(contractId, payload)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('grid.saved'))
        onSaved()
      }
    })
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">{rule ? t('grid.editRule') : t('grid.addRule')}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.routeLabel')} *</label>
            <input className={inputClass} value={routeLabel} onChange={(e) => setRouteLabel(e.target.value)} placeholder="Tanger ↔ Kénitra" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.pickupCity')}</label>
              <input className={inputClass} value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} placeholder="Tanger" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.deliveryCity')}</label>
              <input className={inputClass} value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="Kénitra" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.vehicleType')}</label>
              <select className={inputClass} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="">—</option>
                <option value="motorcycle">{t('vehicle.motorcycle')}</option>
                <option value="van">{t('vehicle.van')}</option>
                <option value="pickup">{t('vehicle.pickup')}</option>
                <option value="truck">{t('vehicle.truck')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.basePrice')} *</label>
              <input className={inputClass} type="number" step="0.01" min="0" value={basePriceMad} onChange={(e) => setBasePriceMad(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('grid.fields.surcharges')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('grid.fields.night')} (%)</label>
                <input className={inputClass} type="number" step="0.01" min="0" value={night} onChange={(e) => setNight(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('grid.fields.weekend')} (%)</label>
                <input className={inputClass} type="number" step="0.01" min="0" value={weekend} onChange={(e) => setWeekend(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('grid.fields.urgent')} (%)</label>
                <input className={inputClass} type="number" step="0.01" min="0" value={urgent} onChange={(e) => setUrgent(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('grid.fields.waiting')} (MAD/h)</label>
                <input className={inputClass} type="number" step="0.01" min="0" value={waiting} onChange={(e) => setWaiting(e.target.value)} />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={customsZone}
              onChange={(e) => setCustomsZone(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t('grid.fields.customsZone')}</span>
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('grid.fields.notes')}</label>
            <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t bg-card p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
