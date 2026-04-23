import { getTranslations } from 'next-intl/server'
import {
  Package, Truck, TrendingUp, DollarSign,
  AlertTriangle, Plus, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatMAD } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function DashboardPage() {
  const [tShipments, tDash, locale, user, supabase] = await Promise.all([
    getTranslations('shipments'),
    getTranslations('dashboard'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: kpis } = await supabase
    .from('v_shipment_kpis')
    .select('*')
    .eq('company_id', user.companyId)
    .single()

  const { data: activeShipments } = await supabase
    .from('shipments')
    .select(`
      id, reference, status, pickup_city, delivery_city,
      delivery_scheduled_at, created_at,
      client:clients(business_name),
      driver:drivers(full_name)
    `)
    .eq('company_id', user.companyId)
    .in('status', ['created', 'assigned', 'picked_up', 'in_transit'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(8)

  const { data: overdueInvoices } = await supabase
    .from('v_overdue_invoices')
    .select('id, invoice_number, client_name, balance_due, days_overdue')
    .eq('company_id', user.companyId)
    .order('days_overdue', { ascending: false })
    .limit(5)

  const onTimeRate = kpis?.on_time_rate_pct != null
    ? `${kpis.on_time_rate_pct.toFixed(1)}%`
    : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title={tDash('title')}
        action={
          <Link
            href={`/${locale}/shipments/new`}
            className="btn-cta focus-ring"
          >
            <Plus className="h-4 w-4" />
            {tDash('newShipment')}
          </Link>
        }
      />

      {/* KPI Grid — staggered entrance */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.08}>
        <StaggerItem>
          <KPICard
            title={tDash('shipmentsToday')}
            value={kpis?.shipments_today ?? 0}
            subtitle={`${kpis?.shipments_this_week ?? 0} ${tDash('shipmentsThisWeek').toLowerCase()}`}
            icon={Package}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={tDash('activeShipments')}
            value={kpis?.active_shipments ?? 0}
            subtitle={`${kpis?.delivered_this_month ?? 0} ${tDash('deliveredThisMonth').toLowerCase()}`}
            icon={Truck}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={tDash('onTimeRate')}
            value={onTimeRate}
            subtitle={tDash('shipmentsThisMonth')}
            icon={TrendingUp}
            iconColor="text-green-600"
            iconBg="bg-green-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={tDash('revenueThisMonth')}
            value={formatMAD(kpis?.revenue_this_month ?? 0)}
            icon={DollarSign}
            iconColor="text-[hsl(var(--cta))]"
            iconBg="bg-[hsl(var(--cta))]/10"
          />
        </StaggerItem>
      </Stagger>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active shipments table */}
        <FadeIn delay={0.2} className="lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-foreground">{tDash('recentShipments')}</h2>
              <Link
                href={`/${locale}/shipments`}
                className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {tDash('viewAll')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              {activeShipments && activeShipments.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tShipments('reference')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tShipments('client')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Trajet
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tShipments('status.label')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeShipments.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/${locale}/shipments/${s.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {s.reference}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(s.client as { business_name: string } | null)?.business_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {s.pickup_city}
                            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                            {s.delivery_city}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Aucune expédition en cours</p>
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Overdue invoices */}
        <FadeIn delay={0.28}>
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-foreground">{tDash('overdueInvoices')}</h2>
              {overdueInvoices && overdueInvoices.length > 0 && (
                <span className="ms-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                  {overdueInvoices.length}
                </span>
              )}
            </div>
            <div className="divide-y">
              {overdueInvoices && overdueInvoices.length > 0 ? (
                overdueInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/${locale}/invoices/${inv.id}`}
                    className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {inv.client_name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoice_number} · {inv.days_overdue}j de retard
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-destructive">
                      {formatMAD(inv.balance_due)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">{tDash('noOverdueInvoices')}</p>
                </div>
              )}
            </div>
            {overdueInvoices && overdueInvoices.length > 0 && (
              <div className="border-t px-5 py-3">
                <Link
                  href={`/${locale}/invoices?status=overdue`}
                  className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {tDash('viewAll')}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
