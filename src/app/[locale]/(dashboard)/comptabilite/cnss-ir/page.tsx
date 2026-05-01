import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, AlertTriangle, CheckCircle2, FileCheck2, ShieldCheck, Receipt as ReceiptIcon } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import { computePayrollLine, aggregatePayroll, type PayrollLine } from '@/lib/accounting/morocco-payroll'
import { MarkDeclaredForm } from '../tva/mark-declared-form'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface CnssIrPageProps {
  searchParams: { period?: string }
}

interface DriverRow {
  id: string
  full_name: string
  monthly_salary: number | null
}

interface ExistingDeclaration {
  status: string
  declaration_date: string | null
  declaration_reference: string | null
  amount_due: number
  amount_paid: number | null
}

function startOfMonthIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

function previousMonthIso(periodIso: string): string {
  const d = new Date(periodIso)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return startOfMonthIso(d)
}

function nextMonthIso(periodIso: string): string {
  const d = new Date(periodIso)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return startOfMonthIso(d)
}

// CNSS deadline: before the 9th of the month following the period.
function cnssDeadline(periodIso: string): Date {
  const next = new Date(nextMonthIso(periodIso))
  next.setUTCDate(9)
  return next
}

// IR (employee withholding) deadline: by the end of the month following.
function irDeadline(periodIso: string): Date {
  const next = new Date(nextMonthIso(periodIso))
  next.setUTCMonth(next.getUTCMonth() + 1)
  next.setUTCDate(0) // last day of "next" month
  return next
}

export default async function CnssIrPage({ searchParams }: CnssIrPageProps) {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const today = new Date()
  const defaultPeriod = previousMonthIso(startOfMonthIso(today))
  const period = searchParams.period && /^\d{4}-\d{2}-01$/.test(searchParams.period)
    ? searchParams.period
    : defaultPeriod

  const supabase = await createClient()

  const [driversResult, cnssExistingResult, irExistingResult] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, full_name, monthly_salary')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('tax_declarations')
      .select('status, declaration_date, declaration_reference, amount_due, amount_paid')
      .eq('company_id', user.companyId)
      .eq('declaration_type', 'cnss')
      .eq('period_month', period)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('tax_declarations')
      .select('status, declaration_date, declaration_reference, amount_due, amount_paid')
      .eq('company_id', user.companyId)
      .eq('declaration_type', 'ir')
      .eq('period_month', period)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  const drivers = ((driversResult.data ?? []) as unknown as DriverRow[])
  const cnssExisting = (cnssExistingResult.data as unknown as ExistingDeclaration | null) ?? null
  const irExisting = (irExistingResult.data as unknown as ExistingDeclaration | null) ?? null

  const linesByDriver: Array<{ driver: DriverRow; line: PayrollLine }> = drivers.map((d) => ({
    driver: d,
    line: computePayrollLine(Number(d.monthly_salary ?? 0)),
  }))
  const aggregate = aggregatePayroll(linesByDriver.map((x) => x.line))

  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'
  const cnssDl = cnssDeadline(period)
  const irDl = irDeadline(period)

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/comptabilite`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('tva.backToAccounting')}
      </Link>

      <PageHeader
        title={t('cnssIr.title')}
        description={t('cnssIr.subtitle', { period: formatDate(period, dateLocale, 'MMMM yyyy') })}
      />

      {/* Period selector */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`?period=${previousMonthIso(period)}`} className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">←</Link>
        <span className="px-2 font-semibold">{formatDate(period, dateLocale, 'MMMM yyyy')}</span>
        <Link href={`?period=${nextMonthIso(period)}`} className="rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">→</Link>
      </div>

      {drivers.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('cnssIr.noDrivers')}
        </p>
      ) : (
        <>
          {/* Provisional notice — figures based on drivers.monthly_salary
              until COMPTA-5 (Paie) writes payroll_data_export rows. */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            {t('cnssIr.provisionalNotice')}
          </div>

          {/* CNSS section */}
          <DeclarationSection
            tone="violet"
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t('cnssIr.cnss.title')}
            subtitle={t('cnssIr.cnss.subtitle')}
            existing={cnssExisting}
            deadline={cnssDl}
            today={today}
            dateLocale={dateLocale}
            statusKey="cnssIr.cnss"
          >
            <CnssTable lines={linesByDriver} aggregate={aggregate} />
            {!cnssExisting && (
              <MarkDeclaredForm
                period={period}
                amountDue={aggregate.cnssMonthlyDue}
                computedSnapshot={{
                  drivers: linesByDriver.map((x) => ({ id: x.driver.id, name: x.driver.full_name, ...x.line })),
                  aggregate,
                }}
                declarationType="cnss"
                title={t('cnssIr.cnss.markDeclared')}
                subtitle={t('cnssIr.cnss.markDeclaredSubtitle', { amount: formatMAD(aggregate.cnssMonthlyDue) })}
              />
            )}
          </DeclarationSection>

          {/* IR section */}
          <DeclarationSection
            tone="amber"
            icon={<ReceiptIcon className="h-5 w-5" />}
            title={t('cnssIr.ir.title')}
            subtitle={t('cnssIr.ir.subtitle')}
            existing={irExisting}
            deadline={irDl}
            today={today}
            dateLocale={dateLocale}
            statusKey="cnssIr.ir"
          >
            <IrTable lines={linesByDriver} aggregate={aggregate} />
            {!irExisting && (
              <MarkDeclaredForm
                period={period}
                amountDue={aggregate.irMonthlyDue}
                computedSnapshot={{
                  drivers: linesByDriver.map((x) => ({ id: x.driver.id, name: x.driver.full_name, ir: x.line.irAmount, gross: x.line.grossSalary })),
                  totalIr: aggregate.totalIr,
                }}
                declarationType="ir"
                title={t('cnssIr.ir.markDeclared')}
                subtitle={t('cnssIr.ir.markDeclaredSubtitle', { amount: formatMAD(aggregate.irMonthlyDue) })}
              />
            )}
          </DeclarationSection>
        </>
      )}
    </div>
  )
}

interface DeclarationSectionProps {
  tone: 'violet' | 'amber'
  icon: React.ReactNode
  title: string
  subtitle: string
  existing: ExistingDeclaration | null
  deadline: Date
  today: Date
  dateLocale: 'fr' | 'ar'
  statusKey: 'cnssIr.cnss' | 'cnssIr.ir'
  children: React.ReactNode
}

async function DeclarationSection({
  tone,
  icon,
  title,
  subtitle,
  existing,
  deadline,
  today,
  dateLocale,
  children,
}: DeclarationSectionProps) {
  const t = await getTranslations('accounting')
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = !existing && daysToDeadline < 0
  const isUrgent = !existing && daysToDeadline >= 0 && daysToDeadline <= 5

  const toneRing = tone === 'violet' ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-700'

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneRing}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {existing ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t(`tva.status.${existing.status}`)}</p>
            <p>{t('tva.declaredOn', {
              date: formatDate(existing.declaration_date, dateLocale),
              ref: existing.declaration_reference ?? '—',
            })}</p>
          </div>
        </div>
      ) : isOverdue ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t('cnssIr.overdue')}</p>
            <p>{t('tva.deadlineWas', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
          </div>
        </div>
      ) : isUrgent ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t('cnssIr.urgent', { days: daysToDeadline })}</p>
            <p>{t('cnssIr.deadline', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t('cnssIr.deadline', { date: formatDate(deadline.toISOString(), dateLocale) })}</p>
        </div>
      )}

      {children}
    </section>
  )
}

async function CnssTable({
  lines,
  aggregate,
}: {
  lines: Array<{ driver: { id: string; full_name: string }; line: PayrollLine }>
  aggregate: ReturnType<typeof aggregatePayroll>
}) {
  const t = await getTranslations('accounting')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start">{t('cnssIr.driver')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.gross')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.cnss.employeeShare')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.cnss.employerShare')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.cnss.amoEmployee')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.cnss.amoEmployer')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map(({ driver, line }) => (
            <tr key={driver.id}>
              <td className="px-3 py-2 font-medium">{driver.full_name}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.grossSalary)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.cnssEmployee)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.cnssEmployer)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.amoEmployee)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.amoEmployer)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/40 text-xs font-semibold">
            <td className="px-3 py-2.5">{t('cnssIr.total')}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalGross)}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalCnssEmployee)}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalCnssEmployer)}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalAmoEmployee)}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalAmoEmployer)}</td>
          </tr>
          <tr className="bg-violet-50 text-sm font-bold">
            <td colSpan={5} className="px-3 py-3 text-end">{t('cnssIr.cnss.monthlyDue')}</td>
            <td className="px-3 py-3 text-end font-mono text-violet-900">{formatMAD(aggregate.cnssMonthlyDue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

async function IrTable({
  lines,
  aggregate,
}: {
  lines: Array<{ driver: { id: string; full_name: string }; line: PayrollLine }>
  aggregate: ReturnType<typeof aggregatePayroll>
}) {
  const t = await getTranslations('accounting')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start">{t('cnssIr.driver')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.gross')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.ir.taxable')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.ir.amount')}</th>
            <th className="px-3 py-2 text-end">{t('cnssIr.net')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map(({ driver, line }) => (
            <tr key={driver.id}>
              <td className="px-3 py-2 font-medium">{driver.full_name}</td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.grossSalary)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs text-muted-foreground">
                {formatMAD(line.grossSalary - line.cnssEmployee - line.amoEmployee)}
              </td>
              <td className="px-3 py-2 text-end font-mono text-xs">{formatMAD(line.irAmount)}</td>
              <td className="px-3 py-2 text-end font-mono text-xs font-semibold">{formatMAD(line.netSalary)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/40 text-xs font-semibold">
            <td className="px-3 py-2.5">{t('cnssIr.total')}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalGross)}</td>
            <td />
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalIr)}</td>
            <td className="px-3 py-2.5 text-end font-mono">{formatMAD(aggregate.totalNet)}</td>
          </tr>
          <tr className="bg-amber-50 text-sm font-bold">
            <td colSpan={3} className="px-3 py-3 text-end">{t('cnssIr.ir.monthlyDue')}</td>
            <td className="px-3 py-3 text-end font-mono text-amber-900">{formatMAD(aggregate.irMonthlyDue)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
