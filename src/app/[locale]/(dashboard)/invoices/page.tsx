import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  FileText, Search, AlertTriangle, DollarSign, Wallet,
  CheckCircle2, ArrowRight, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ExcelExportLink } from '@/components/shared/excel-export-link'
import { InvoiceStatusBadge } from '@/components/shared/invoice-status-badge'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/types/database.types'

const STATUSES: InvoiceStatus[] = ['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled']

const STATUS_DOT: Record<InvoiceStatus, string> = {
  unpaid: 'bg-amber-500',
  partially_paid: 'bg-blue-500',
  paid: 'bg-emerald-500',
  overdue: 'bg-rose-500',
  cancelled: 'bg-gray-400',
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const [t, tCommon, locale, user, supabase, sp] = await Promise.all([
    getTranslations('invoices'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null
  const companyId = user.companyId
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  const startOfMonth = (() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  })()

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, issued_at, due_at, total_incl_tax, amount_paid, status,
      client:clients(business_name)
    `)
    .eq('company_id', companyId)
    .order('issued_at', { ascending: false })

  if (sp.status && sp.status !== 'all') query = query.eq('status', sp.status as InvoiceStatus)
  if (sp.q) query = query.ilike('invoice_number', `%${sp.q}%`)

  const [{ data: invoices }, allRes, monthlyRes, paymentsRes] = await Promise.all([
    query.limit(100),
    supabase
      .from('invoices')
      .select('id, status, total_incl_tax, amount_paid, due_at, issued_at')
      .eq('company_id', companyId),
    supabase
      .from('invoices')
      .select('id, total_incl_tax')
      .eq('company_id', companyId)
      .gte('issued_at', startOfMonth),
    supabase
      .from('invoice_payments')
      .select('id, amount, payment_date')
      .eq('company_id', companyId)
      .gte('payment_date', startOfMonth),
  ])

  const activeFilter = sp.status ?? 'all'
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  // Stats
  const allInvoices = (allRes.data ?? []) as Array<{
    id: string; status: InvoiceStatus
    total_incl_tax: number; amount_paid: number | null
    due_at: string; issued_at: string
  }>

  const monthlyInvoices = monthlyRes.data ?? []
  const totalRevenueMonth = monthlyInvoices.reduce(
    (s, i) => s + Number((i as { total_incl_tax: number }).total_incl_tax ?? 0),
    0,
  )

  const outstanding = allInvoices.filter((i) =>
    i.status === 'unpaid' || i.status === 'partially_paid' || i.status === 'overdue',
  )
  const outstandingAmount = outstanding.reduce(
    (s, i) => s + (Number(i.total_incl_tax) - Number(i.amount_paid ?? 0)),
    0,
  )

  const overdueCount = allInvoices.filter((i) =>
    (i.status === 'unpaid' || i.status === 'partially_paid' || i.status === 'overdue') &&
    i.due_at < todayIso,
  ).length

  const paidThisMonth = (paymentsRes.data ?? []) as Array<{ amount: number }>
  const paidAmount = paidThisMonth.reduce((s, p) => s + Number(p.amount ?? 0), 0)

  // Per-status counts for filter pills
  const statusCounts: Record<string, number> = { all: 0 }
  for (const s of STATUSES) statusCounts[s] = 0
  for (const inv of allInvoices) {
    statusCounts.all++
    if (statusCounts[inv.status] != null) statusCounts[inv.status]++
  }

  const isOverdue = (dueDate: string, status: InvoiceStatus) =>
    status !== 'paid' && status !== 'cancelled' && dueDate < todayIso

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <ExcelExportLink
            href={`/api/exports/invoices${sp.status ? `?status=${encodeURIComponent(sp.status)}` : ''}`}
            label={t('exportExcel')}
          />
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.totalRevenue')}
            value={formatMAD(totalRevenueMonth)}
            subtitle={t('stats.totalRevenueSubtitle', { count: monthlyInvoices.length })}
            icon={DollarSign}
            iconColor="text-[hsl(var(--cta))]"
            iconBg="bg-[hsl(var(--cta))]/10"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.outstanding')}
            value={formatMAD(outstandingAmount)}
            subtitle={t('stats.outstandingSubtitle', { count: outstanding.length })}
            icon={Wallet}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.overdue')}
            value={overdueCount}
            subtitle={t('stats.overdueSubtitle', { count: overdueCount })}
            icon={AlertTriangle}
            iconColor={overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'}
            iconBg={overdueCount > 0 ? 'bg-rose-100' : 'bg-emerald-100'}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.paid')}
            value={formatMAD(paidAmount)}
            subtitle={t('stats.paidSubtitle', { count: paidThisMonth.length })}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Filter bar */}
      <FadeIn delay={0.16}>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <form className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={sp.q}
              placeholder={t('filter.search')}
              className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </form>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <FilterPill
              href={`/${locale}/invoices`}
              active={activeFilter === 'all'}
              label={tCommon('all')}
              count={statusCounts.all}
              dotClass="bg-primary"
            />
            {STATUSES.map((s) => (
              <FilterPill
                key={s}
                href={`/${locale}/invoices?status=${s}`}
                active={activeFilter === s}
                label={t(`status.${s}`)}
                count={statusCounts[s] ?? 0}
                dotClass={STATUS_DOT[s]}
              />
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.22}>
        <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('number')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('client')}
                    </th>
                    <th className="hidden px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                      {t('issueDate')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('dueDate')}
                    </th>
                    <th className="hidden px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                      {t('amount')}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('balance')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('status.label')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const client = inv.client as { business_name: string } | null
                    const balance = Number(inv.total_incl_tax) - Number(inv.amount_paid ?? 0)
                    const overdue = isOverdue(inv.due_at, inv.status as InvoiceStatus)
                    const status = inv.status as InvoiceStatus

                    return (
                      <tr key={inv.id} className="group transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/${locale}/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {inv.invoice_number}
                            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {client?.business_name ?? '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(inv.issued_at, dateLocale)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={cn(
                            'inline-flex items-center gap-1',
                            overdue ? 'font-semibold text-rose-700' : 'text-muted-foreground',
                          )}>
                            {overdue && <AlertTriangle className="h-3 w-3" />}
                            {formatDate(inv.due_at, dateLocale)}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-end font-medium tabular-nums text-foreground lg:table-cell">
                          {formatMAD(inv.total_incl_tax)}
                        </td>
                        <td className="px-4 py-3 text-end font-bold tabular-nums">
                          {balance > 0 ? (
                            <span className={overdue ? 'text-rose-700' : 'text-foreground'}>
                              {formatMAD(balance)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={status} size="sm" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : statusCounts.all === 0 ? (
            <div className="relative overflow-hidden p-12 text-center">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              />
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-foreground">{t('noInvoices')}</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                {t('noInvoicesHint')}
              </p>
            </div>
          ) : (
            <div className="p-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noResults')}</p>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  )
}

function FilterPill({
  href, active, label, count, dotClass,
}: {
  href: string; active: boolean; label: string; count: number; dotClass: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-soft'
          : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white/80' : dotClass)} />
      {label}
      <span className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
        active ? 'bg-white/20' : 'bg-background',
      )}>
        {count}
      </span>
    </Link>
  )
}
