'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, Save, Loader2, Lock, Sparkles } from 'lucide-react'
import { updatePayrollLine, validateMonthlyPayroll, type PayrollViewLine } from '@/actions/payroll'
import { computePayrollLine } from '@/lib/accounting/morocco-payroll'
import { formatMAD } from '@/lib/utils/formatters'
import type { PayrollStatus } from '@/types/database.types'

interface PayrollTableProps {
  initialLines: PayrollViewLine[]
  period: string
}

interface RowState {
  baseSalary: string
  bonusesMad: string
  deductionsMad: string
  overtimeHours: string
  workingDays: string
  notes: string
  saving: boolean
}

export function PayrollTable({ initialLines, period }: PayrollTableProps) {
  const t = useTranslations('accounting')
  const router = useRouter()

  const [editing, setEditing] = useState<Record<string, RowState>>(() => {
    const obj: Record<string, RowState> = {}
    for (const line of initialLines) {
      obj[line.id] = {
        baseSalary: String(line.baseSalary),
        bonusesMad: String(line.bonusesMad),
        deductionsMad: String(line.deductionsMad),
        overtimeHours: String(line.overtimeHours),
        workingDays: String(line.workingDays),
        notes: line.notes ?? '',
        saving: false,
      }
    }
    return obj
  })
  const [isPending, startTransition] = useTransition()

  const allValidated = initialLines.every((l) => l.status !== 'draft')
  const anyDraft = initialLines.some((l) => l.status === 'draft')

  function setField<K extends keyof RowState>(id: string, key: K, value: RowState[K]) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function recompute(id: string) {
    const state = editing[id]
    if (!state) return null
    const base = Number(state.baseSalary) || 0
    const bonuses = Number(state.bonusesMad) || 0
    const deductions = Number(state.deductionsMad) || 0
    const computed = computePayrollLine(base + bonuses)
    const net = Math.max(0, computed.netSalary - deductions)
    return { computed, net, base, bonuses, deductions }
  }

  function saveLine(line: PayrollViewLine) {
    const state = editing[line.id]
    if (!state) return
    setEditing((prev) => ({ ...prev, [line.id]: { ...prev[line.id], saving: true } }))
    startTransition(async () => {
      const result = await updatePayrollLine(line.id, {
        baseSalary: Number(state.baseSalary) || 0,
        bonusesMad: Number(state.bonusesMad) || 0,
        deductionsMad: Number(state.deductionsMad) || 0,
        overtimeHours: Number(state.overtimeHours) || 0,
        workingDays: Number(state.workingDays) || 0,
        notes: state.notes.trim() || null,
      })
      setEditing((prev) => ({ ...prev, [line.id]: { ...prev[line.id], saving: false } }))
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('paie.saved'))
        router.refresh()
      }
    })
  }

  function validateAll() {
    if (!confirm(t('paie.confirmValidate'))) return
    startTransition(async () => {
      const result = await validateMonthlyPayroll(period)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('paie.validated', { count: result.data?.count ?? 0 }))
        router.refresh()
      }
    })
  }

  const totals = useMemo(() => {
    let totalBase = 0
    let totalBonuses = 0
    let totalDeductions = 0
    let totalCnssEmp = 0
    let totalAmoEmp = 0
    let totalIr = 0
    let totalNet = 0
    let totalEmployerCost = 0
    for (const line of initialLines) {
      const r = recompute(line.id)
      if (!r) continue
      totalBase += r.base
      totalBonuses += r.bonuses
      totalDeductions += r.deductions
      totalCnssEmp += r.computed.cnssEmployee
      totalAmoEmp += r.computed.amoEmployee
      totalIr += r.computed.irAmount
      totalNet += r.net
      totalEmployerCost += r.computed.employerTotalCost
    }
    return { totalBase, totalBonuses, totalDeductions, totalCnssEmp, totalAmoEmp, totalIr, totalNet, totalEmployerCost }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, initialLines])

  return (
    <div className="space-y-4">
      {allValidated && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Lock className="h-4 w-4" />
          <span>{t('paie.allValidated')}</span>
        </div>
      )}

      <div className="space-y-3">
        {initialLines.map((line) => {
          const state = editing[line.id]
          const recomputed = recompute(line.id)
          const locked = line.status !== 'draft'
          if (!state || !recomputed) return null

          return (
            <div key={line.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{line.driverName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t(`paie.status.${line.status}`)}
                    {line.advancesFromCapture > 0 && (
                      <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                        <Sparkles className="h-3 w-3" />
                        {t('paie.advancesAuto', { amount: formatMAD(line.advancesFromCapture) })}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {formatMAD(recomputed.net)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                <FieldInput
                  label={t('paie.fields.baseSalary')}
                  value={state.baseSalary}
                  onChange={(v) => setField(line.id, 'baseSalary', v)}
                  disabled={locked}
                  type="number"
                />
                <FieldInput
                  label={t('paie.fields.bonuses')}
                  value={state.bonusesMad}
                  onChange={(v) => setField(line.id, 'bonusesMad', v)}
                  disabled={locked}
                  type="number"
                />
                <FieldInput
                  label={t('paie.fields.deductions')}
                  value={state.deductionsMad}
                  onChange={(v) => setField(line.id, 'deductionsMad', v)}
                  disabled={locked}
                  type="number"
                />
                <FieldInput
                  label={t('paie.fields.overtimeHours')}
                  value={state.overtimeHours}
                  onChange={(v) => setField(line.id, 'overtimeHours', v)}
                  disabled={locked}
                  type="number"
                />
                <FieldInput
                  label={t('paie.fields.workingDays')}
                  value={state.workingDays}
                  onChange={(v) => setField(line.id, 'workingDays', v)}
                  disabled={locked}
                  type="number"
                />
              </div>

              <dl className="mt-3 grid gap-1.5 rounded-lg bg-muted/30 p-3 text-xs sm:grid-cols-2 md:grid-cols-4">
                <Stat label={t('paie.calc.gross')} value={formatMAD(recomputed.base + recomputed.bonuses)} />
                <Stat label={t('paie.calc.cnssEmp')} value={formatMAD(recomputed.computed.cnssEmployee)} />
                <Stat label={t('paie.calc.amoEmp')} value={formatMAD(recomputed.computed.amoEmployee)} />
                <Stat label={t('paie.calc.ir')} value={formatMAD(recomputed.computed.irAmount)} />
                <Stat label={t('paie.calc.cnssEmployer')} value={formatMAD(recomputed.computed.cnssEmployer)} muted />
                <Stat label={t('paie.calc.amoEmployer')} value={formatMAD(recomputed.computed.amoEmployer)} muted />
                <Stat label={t('paie.calc.familyAllowance')} value={formatMAD(recomputed.computed.familyAllowance)} muted />
                <Stat label={t('paie.calc.employerCost')} value={formatMAD(recomputed.computed.employerTotalCost)} bold />
              </dl>

              {!locked && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveLine(line)}
                    disabled={state.saving || isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {state.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('paie.saveLine')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-foreground">{t('paie.totals.title')}</h2>
        </div>
        <dl className="grid gap-x-6 gap-y-2 p-5 text-sm md:grid-cols-2">
          <TotalRow label={t('paie.totals.gross')} value={totals.totalBase + totals.totalBonuses} />
          <TotalRow label={t('paie.totals.cnss')} value={totals.totalCnssEmp} />
          <TotalRow label={t('paie.totals.amo')} value={totals.totalAmoEmp} />
          <TotalRow label={t('paie.totals.ir')} value={totals.totalIr} />
          <TotalRow label={t('paie.totals.deductions')} value={totals.totalDeductions} />
          <TotalRow label={t('paie.totals.employerCost')} value={totals.totalEmployerCost} muted />
          <TotalRow label={t('paie.totals.netToPay')} value={totals.totalNet} highlight />
        </dl>
      </section>

      {anyDraft && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={validateAll}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('paie.validateAll')}
          </button>
        </div>
      )}
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  disabled,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  type: 'number' | 'text'
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground"
      />
    </div>
  )
}

function Stat({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={muted ? 'text-muted-foreground' : 'text-foreground/80'}>{label}</dt>
      <dd className={`font-mono ${bold ? 'font-bold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </dd>
    </div>
  )
}

function TotalRow({ label, value, highlight, muted }: { label: string; value: number; highlight?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b py-2 last:border-0 ${
        highlight ? 'border-2 border-emerald-200 bg-emerald-50/50 px-3 rounded-lg font-bold' : ''
      } ${muted ? 'text-muted-foreground' : ''}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatMAD(value)}</span>
    </div>
  )
}
