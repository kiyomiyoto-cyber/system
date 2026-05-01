// ============================================================
// Moroccan payroll calculator
//
// Source: 2026 CNSS / AMO / IR scales as published by Direction
// Générale des Impôts and CNSS. Values centralised here so COMPTA-5
// (Paie) and COMPTA-7 (CNSS/IR) compute the same numbers.
//
// Caveat: the IR brackets are the simplified salary IR (sur revenus
// salariaux) — not the corporate IS. The 6 000 MAD CNSS ceiling is
// the official CNSS plafond.
// ============================================================

const CNSS_CEILING_MAD = 6_000

const RATES = {
  cnssEmployee: 0.0448,        // 4.48% capped at 6 000 MAD
  cnssEmployer: 0.0898,        // 8.98% capped at 6 000 MAD (prestations sociales)
  amoEmployee: 0.0226,         // 2.26% on uncapped gross
  amoEmployer: 0.0411,         // 4.11% on uncapped gross
  familyAllowance: 0.064,      // 6.4% employer on uncapped gross
  vocationalTraining: 0.016,   // 1.6% employer on uncapped gross
} as const

interface IrBracket {
  upTo: number      // monthly cap (MAD); Infinity for the top bracket
  rate: number      // marginal rate
  deduction: number // sum-deduction for fast computation
}

// Monthly IR brackets — derived from the annual scale divided by 12.
// Using the 2026 simplified salary scale.
const IR_BRACKETS: readonly IrBracket[] = [
  { upTo: 2_500,    rate: 0,    deduction: 0 },
  { upTo: 4_166.67, rate: 0.10, deduction: 250 },
  { upTo: 5_000,    rate: 0.20, deduction: 666.67 },
  { upTo: 6_666.67, rate: 0.30, deduction: 1_166.67 },
  { upTo: 15_000,   rate: 0.34, deduction: 1_433.33 },
  { upTo: Infinity, rate: 0.38, deduction: 2_033.33 },
]

export interface PayrollLine {
  grossSalary: number
  cnssEmployee: number
  cnssEmployer: number
  amoEmployee: number
  amoEmployer: number
  familyAllowance: number
  vocationalTraining: number
  irAmount: number
  netSalary: number
  /** Total cost to the employer for this driver (gross + employer charges). */
  employerTotalCost: number
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function computeIr(grossTaxable: number): number {
  for (const bracket of IR_BRACKETS) {
    if (grossTaxable <= bracket.upTo) {
      return Math.max(0, round2(grossTaxable * bracket.rate - bracket.deduction))
    }
  }
  // unreachable: Infinity bracket is final
  return 0
}

export function computePayrollLine(grossSalary: number): PayrollLine {
  if (!Number.isFinite(grossSalary) || grossSalary < 0) {
    return zeroLine()
  }

  const capped = Math.min(grossSalary, CNSS_CEILING_MAD)

  const cnssEmployee = round2(capped * RATES.cnssEmployee)
  const cnssEmployer = round2(capped * RATES.cnssEmployer)
  const amoEmployee = round2(grossSalary * RATES.amoEmployee)
  const amoEmployer = round2(grossSalary * RATES.amoEmployer)
  const familyAllowance = round2(grossSalary * RATES.familyAllowance)
  const vocationalTraining = round2(grossSalary * RATES.vocationalTraining)

  // Taxable salary for IR (simplified): gross minus mandatory employee
  // social contributions. Real DGI rules deduct an additional "frais
  // professionnels" 35% allowance with caps — we omit that here to
  // stay conservative; an admin can fine-tune via the bonuses field
  // at COMPTA-5 time.
  const taxable = Math.max(0, grossSalary - cnssEmployee - amoEmployee)
  const irAmount = computeIr(taxable)

  const netSalary = round2(grossSalary - cnssEmployee - amoEmployee - irAmount)

  const employerTotalCost = round2(
    grossSalary
    + cnssEmployer
    + amoEmployer
    + familyAllowance
    + vocationalTraining,
  )

  return {
    grossSalary: round2(grossSalary),
    cnssEmployee,
    cnssEmployer,
    amoEmployee,
    amoEmployer,
    familyAllowance,
    vocationalTraining,
    irAmount,
    netSalary,
    employerTotalCost,
  }
}

function zeroLine(): PayrollLine {
  return {
    grossSalary: 0,
    cnssEmployee: 0,
    cnssEmployer: 0,
    amoEmployee: 0,
    amoEmployer: 0,
    familyAllowance: 0,
    vocationalTraining: 0,
    irAmount: 0,
    netSalary: 0,
    employerTotalCost: 0,
  }
}

export interface PayrollAggregate {
  count: number
  totalGross: number
  totalCnssEmployee: number
  totalCnssEmployer: number
  totalAmoEmployee: number
  totalAmoEmployer: number
  totalFamilyAllowance: number
  totalVocationalTraining: number
  totalIr: number
  totalNet: number
  totalEmployerCost: number
  /** What CNSS expects each month (employee + employer share, family + vocational). */
  cnssMonthlyDue: number
  /** What the Treasury expects each month (employee IR withheld). */
  irMonthlyDue: number
}

export function aggregatePayroll(lines: readonly PayrollLine[]): PayrollAggregate {
  const totals = lines.reduce(
    (acc, l) => {
      acc.totalGross += l.grossSalary
      acc.totalCnssEmployee += l.cnssEmployee
      acc.totalCnssEmployer += l.cnssEmployer
      acc.totalAmoEmployee += l.amoEmployee
      acc.totalAmoEmployer += l.amoEmployer
      acc.totalFamilyAllowance += l.familyAllowance
      acc.totalVocationalTraining += l.vocationalTraining
      acc.totalIr += l.irAmount
      acc.totalNet += l.netSalary
      acc.totalEmployerCost += l.employerTotalCost
      return acc
    },
    {
      totalGross: 0,
      totalCnssEmployee: 0,
      totalCnssEmployer: 0,
      totalAmoEmployee: 0,
      totalAmoEmployer: 0,
      totalFamilyAllowance: 0,
      totalVocationalTraining: 0,
      totalIr: 0,
      totalNet: 0,
      totalEmployerCost: 0,
    },
  )

  const cnssMonthlyDue = round2(
    totals.totalCnssEmployee
    + totals.totalCnssEmployer
    + totals.totalAmoEmployee
    + totals.totalAmoEmployer
    + totals.totalFamilyAllowance
    + totals.totalVocationalTraining,
  )

  return {
    count: lines.length,
    ...totals,
    totalGross: round2(totals.totalGross),
    totalCnssEmployee: round2(totals.totalCnssEmployee),
    totalCnssEmployer: round2(totals.totalCnssEmployer),
    totalAmoEmployee: round2(totals.totalAmoEmployee),
    totalAmoEmployer: round2(totals.totalAmoEmployer),
    totalFamilyAllowance: round2(totals.totalFamilyAllowance),
    totalVocationalTraining: round2(totals.totalVocationalTraining),
    totalIr: round2(totals.totalIr),
    totalNet: round2(totals.totalNet),
    totalEmployerCost: round2(totals.totalEmployerCost),
    cnssMonthlyDue,
    irMonthlyDue: round2(totals.totalIr),
  }
}

export const PAYROLL_RATES = RATES
export const PAYROLL_CNSS_CEILING = CNSS_CEILING_MAD
