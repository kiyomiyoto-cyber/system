'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { computePayrollLine } from '@/lib/accounting/morocco-payroll'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type { PayrollStatus } from '@/types/database.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable'] as const

interface AuthCheckOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}
type AuthCheck = AuthCheckOk | { ok: false; error: string }

async function ensureBackOffice(): Promise<AuthCheck> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

function nextMonthIso(periodMonth: string): string {
  const d = new Date(periodMonth)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export interface PayrollViewLine {
  id: string
  driverId: string
  driverName: string
  periodMonth: string
  baseSalary: number
  bonusesMad: number
  deductionsMad: number
  overtimeHours: number
  workingDays: number
  missionsCount: number
  totalKmDriven: number
  cnssEmployeePart: number
  cnssEmployerPart: number
  amoEmployeePart: number
  amoEmployerPart: number
  familyAllowance: number
  vocationalTraining: number
  irAmount: number
  netSalaryMad: number
  grossSalaryEffective: number
  status: PayrollStatus
  paymentDate: string | null
  notes: string | null
  /** Sum of validated driver_advance documents for this driver / month
   *  (informational — admin can override deductions_mad). */
  advancesFromCapture: number
}

export async function loadOrInitMonthlyPayroll(
  periodMonth: string,
): Promise<ActionResult<PayrollViewLine[]>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    return { data: null, error: 'Période invalide.' }
  }

  const supabase = await createClient()
  const periodEnd = nextMonthIso(periodMonth)

  const [driversResult, payrollResult, advancesResult] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, full_name, monthly_salary')
      .eq('company_id', auth.companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('payroll_data_export')
      .select('*')
      .eq('company_id', auth.companyId)
      .eq('period_month', periodMonth)
      .is('deleted_at', null),
    supabase
      .from('accounting_documents')
      .select('linked_driver_id, amount_ttc')
      .eq('company_id', auth.companyId)
      .eq('document_category', 'driver_advance')
      .in('status', ['validated', 'sent_to_accountant'])
      .gte('captured_at', periodMonth)
      .lt('captured_at', periodEnd)
      .is('deleted_at', null),
  ])

  type DriverRow = { id: string; full_name: string; monthly_salary: number | null }
  type PayrollRow = {
    id: string
    driver_id: string
    period_month: string
    gross_salary_mad: number
    bonuses_mad: number
    deductions_mad: number
    overtime_hours: number
    working_days: number
    missions_count: number
    total_km_driven: number
    cnss_employee_part: number
    cnss_employer_part: number
    amo_employee_part: number
    amo_employer_part: number
    family_allowance: number
    vocational_training: number
    ir_amount: number
    net_salary_mad: number
    status: PayrollStatus
    payment_date: string | null
    notes: string | null
  }
  type AdvanceRow = { linked_driver_id: string | null; amount_ttc: number }

  const drivers = (driversResult.data ?? []) as unknown as DriverRow[]
  const existing = (payrollResult.data ?? []) as unknown as PayrollRow[]
  const advances = (advancesResult.data ?? []) as unknown as AdvanceRow[]

  const advancesByDriver = new Map<string, number>()
  for (const a of advances) {
    if (!a.linked_driver_id) continue
    advancesByDriver.set(
      a.linked_driver_id,
      (advancesByDriver.get(a.linked_driver_id) ?? 0) + Number(a.amount_ttc),
    )
  }

  const existingByDriver = new Map(existing.map((p) => [p.driver_id, p]))

  const lines: PayrollViewLine[] = []
  for (const driver of drivers) {
    const advancesTotal = advancesByDriver.get(driver.id) ?? 0
    const row = existingByDriver.get(driver.id)
    if (row) {
      lines.push({
        id: row.id,
        driverId: driver.id,
        driverName: driver.full_name,
        periodMonth,
        baseSalary: Number(row.gross_salary_mad),
        bonusesMad: Number(row.bonuses_mad),
        deductionsMad: Number(row.deductions_mad),
        overtimeHours: Number(row.overtime_hours),
        workingDays: row.working_days,
        missionsCount: row.missions_count,
        totalKmDriven: Number(row.total_km_driven),
        cnssEmployeePart: Number(row.cnss_employee_part),
        cnssEmployerPart: Number(row.cnss_employer_part),
        amoEmployeePart: Number(row.amo_employee_part),
        amoEmployerPart: Number(row.amo_employer_part),
        familyAllowance: Number(row.family_allowance),
        vocationalTraining: Number(row.vocational_training),
        irAmount: Number(row.ir_amount),
        netSalaryMad: Number(row.net_salary_mad),
        grossSalaryEffective: Number(row.gross_salary_mad) + Number(row.bonuses_mad),
        status: row.status,
        paymentDate: row.payment_date,
        notes: row.notes,
        advancesFromCapture: advancesTotal,
      })
      continue
    }

    // No row yet — initialise a draft from drivers.monthly_salary +
    // pre-fill deductions from captured driver_advance documents.
    const baseSalary = Number(driver.monthly_salary ?? 0)
    const computed = computePayrollLine(baseSalary)
    const draftId = crypto.randomUUID()
    const { error: insertError } = await supabase
      .from('payroll_data_export')
      .insert({
        id: draftId,
        company_id: auth.companyId,
        driver_id: driver.id,
        period_month: periodMonth,
        gross_salary_mad: baseSalary,
        bonuses_mad: 0,
        deductions_mad: advancesTotal,
        cnss_employee_part: computed.cnssEmployee,
        cnss_employer_part: computed.cnssEmployer,
        amo_employee_part: computed.amoEmployee,
        amo_employer_part: computed.amoEmployer,
        family_allowance: computed.familyAllowance,
        vocational_training: computed.vocationalTraining,
        ir_amount: computed.irAmount,
        net_salary_mad: Math.max(0, computed.netSalary - advancesTotal),
        status: 'draft',
      })

    if (insertError) {
      logger.error('payroll.init_failed', {
        action: 'loadOrInitMonthlyPayroll',
        userId: auth.user.id,
        companyId: auth.companyId,
        driverId: driver.id,
        error: insertError.message,
      })
      continue
    }

    lines.push({
      id: draftId,
      driverId: driver.id,
      driverName: driver.full_name,
      periodMonth,
      baseSalary,
      bonusesMad: 0,
      deductionsMad: advancesTotal,
      overtimeHours: 0,
      workingDays: 0,
      missionsCount: 0,
      totalKmDriven: 0,
      cnssEmployeePart: computed.cnssEmployee,
      cnssEmployerPart: computed.cnssEmployer,
      amoEmployeePart: computed.amoEmployee,
      amoEmployerPart: computed.amoEmployer,
      familyAllowance: computed.familyAllowance,
      vocationalTraining: computed.vocationalTraining,
      irAmount: computed.irAmount,
      netSalaryMad: Math.max(0, computed.netSalary - advancesTotal),
      grossSalaryEffective: baseSalary,
      status: 'draft',
      paymentDate: null,
      notes: null,
      advancesFromCapture: advancesTotal,
    })
  }

  return { data: lines, error: null }
}

const updateLineSchema = z.object({
  baseSalary: z.coerce.number().nonnegative().max(1_000_000),
  bonusesMad: z.coerce.number().nonnegative().max(1_000_000),
  deductionsMad: z.coerce.number().nonnegative().max(1_000_000),
  overtimeHours: z.coerce.number().nonnegative().max(744).optional(), // 31 days × 24h
  workingDays: z.coerce.number().int().nonnegative().max(31).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export type UpdatePayrollLineInput = z.input<typeof updateLineSchema>

export async function updatePayrollLine(
  payrollId: string,
  rawInput: UpdatePayrollLineInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(payrollId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = updateLineSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('payroll_data_export')
    .select('id, status')
    .eq('id', payrollId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) return { data: null, error: 'Ligne paie introuvable.' }
  if (existing.status === 'paid') {
    return { data: null, error: 'Paie déjà payée — modification interdite.' }
  }

  const effectiveGross = input.baseSalary + input.bonusesMad
  const computed = computePayrollLine(effectiveGross)
  const netAfterDeductions = Math.max(0, computed.netSalary - input.deductionsMad)

  const { error } = await supabase
    .from('payroll_data_export')
    .update({
      gross_salary_mad: input.baseSalary,
      bonuses_mad: input.bonusesMad,
      deductions_mad: input.deductionsMad,
      overtime_hours: input.overtimeHours ?? 0,
      working_days: input.workingDays ?? 0,
      cnss_employee_part: computed.cnssEmployee,
      cnss_employer_part: computed.cnssEmployer,
      amo_employee_part: computed.amoEmployee,
      amo_employer_part: computed.amoEmployer,
      family_allowance: computed.familyAllowance,
      vocational_training: computed.vocationalTraining,
      ir_amount: computed.irAmount,
      net_salary_mad: netAfterDeductions,
      notes: input.notes ?? null,
    })
    .eq('id', payrollId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('payroll.update_failed', {
      action: 'updatePayrollLine',
      userId: auth.user.id,
      companyId: auth.companyId,
      payrollId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'payroll_data',
    entityId: payrollId,
    action: 'update',
    afterState: {
      gross_salary_mad: input.baseSalary,
      bonuses_mad: input.bonusesMad,
      deductions_mad: input.deductionsMad,
      net_salary_mad: netAfterDeductions,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/comptabilite/paie', 'page')
  return { data: { id: payrollId }, error: null }
}

export async function validateMonthlyPayroll(
  periodMonth: string,
): Promise<ActionResult<{ count: number }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    return { data: null, error: 'Période invalide.' }
  }

  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('payroll_data_export')
    .select('id, driver_id, gross_salary_mad, bonuses_mad, deductions_mad, net_salary_mad, status')
    .eq('company_id', auth.companyId)
    .eq('period_month', periodMonth)
    .eq('status', 'draft')
    .is('deleted_at', null)

  type Row = {
    id: string
    driver_id: string
    gross_salary_mad: number
    bonuses_mad: number
    deductions_mad: number
    net_salary_mad: number
    status: PayrollStatus
  }
  const rows = (drafts ?? []) as unknown as Row[]
  if (rows.length === 0) {
    return { data: null, error: 'Aucune ligne en draft à valider.' }
  }

  const validatedAt = new Date().toISOString()
  const ids = rows.map((r) => r.id)

  const { error } = await supabase
    .from('payroll_data_export')
    .update({
      status: 'validated',
      validated_at: validatedAt,
      validated_by_user_id: auth.user.id,
    })
    .in('id', ids)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('payroll.validate_failed', {
      action: 'validateMonthlyPayroll',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la validation.' }
  }

  await Promise.all(
    rows.map((row) =>
      recordAccountingAudit({
        companyId: auth.companyId,
        entityType: 'payroll_data',
        entityId: row.id,
        action: 'validate',
        afterState: {
          driver_id: row.driver_id,
          gross_salary_mad: row.gross_salary_mad,
          bonuses_mad: row.bonuses_mad,
          deductions_mad: row.deductions_mad,
          net_salary_mad: row.net_salary_mad,
          status: 'validated',
        },
        actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
      }),
    ),
  )

  revalidatePath('/[locale]/(dashboard)/comptabilite/paie', 'page')
  revalidatePath('/[locale]/(dashboard)/comptabilite/cnss-ir', 'page')
  return { data: { count: rows.length }, error: null }
}
