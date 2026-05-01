import { getTranslations, getLocale } from 'next-intl/server'
import {
  Package, Truck, TrendingUp, DollarSign,
  AlertTriangle, Plus, ArrowRight,
  Calendar, Handshake, Zap, FileWarning, Bell,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatMAD } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'
import {
  StatusBreakdown,
  FleetSnapshot,
  RevenueTrend,
  TopClients,
  ActivityFeed,
  QuickStats,
} from './widgets'

const STATUS_KEYS: ShipmentStatus[] = [
  'created', 'assigned', 'picked_up', 'in_transit',
  'customs_clearance', 'delivered', 'failed', 'cancelled',
]

function getGreetingKey(): 'welcomeMorning' | 'welcomeAfternoon' | 'welcomeEvening' {
  const h = new Date().getHours()
  if (h < 12) return 'welcomeMorning'
  if (h < 18) return 'welcomeAfternoon'
  return 'welcomeEvening'
}

function startOfDayISO(daysAgo: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const [tShipments, tDash, locale, user, supabase] = await Promise.all([
    getTranslations('shipments'),
    getTranslations('dashboard'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null
  const companyId = user.companyId
  const greetingKey = getGreetingKey()
  const firstName = user.fullName?.split(' ')[0] ?? ''

  const fourteenDaysAgo = startOfDayISO(13)
  const startOfMonth = (() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const startOfLastMonth = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const startOfToday = startOfDayISO(0)
  const endOfToday = (() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  })()

  const [
    kpisRes,
    activeShipmentsRes,
    overdueInvoicesRes,
    statusCountsRes,
    driversRes,
    vehiclesRes,
    clientsCountRes,
    pendingInvoicesRes,
    monthlyInvoicesRes,
    recentDeliveriesRes,
    activityRes,
    todayProgramRes,
    monthSubMarginRes,
    activeSubcontractsRes,
    jitAlertsRes,
    customsAlertsRes,
    lastMonthInvoicesRes,
  ] = await Promise.all([
    supabase
      .from('v_shipment_kpis')
      .select('*')
      .eq('company_id', companyId)
      .single(),

    supabase
      .from('shipments')
      .select(`
        id, reference, status, pickup_city, delivery_city,
        delivery_scheduled_at, created_at, price_incl_tax,
        client:clients(business_name),
        driver:drivers(full_name)
      `)
      .eq('company_id', companyId)
      .in('status', ['created', 'assigned', 'picked_up', 'in_transit'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8),

    supabase
      .from('v_overdue_invoices')
      .select('id, invoice_number, client_name, balance_due, days_overdue')
      .eq('company_id', companyId)
      .order('days_overdue', { ascending: false })
      .limit(5),

    supabase
      .from('shipments')
      .select('status')
      .eq('company_id', companyId)
      .is('deleted_at', null),

    supabase
      .from('drivers')
      .select('id, is_available')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null),

    supabase
      .from('vehicles')
      .select('id, is_available')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null),

    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null),

    supabase
      .from('invoices')
      .select('id, total_incl_tax, amount_paid, status')
      .eq('company_id', companyId)
      .in('status', ['unpaid', 'partially_paid']),

    supabase
      .from('invoices')
      .select('total_incl_tax, client_id, client:clients(business_name)')
      .eq('company_id', companyId)
      .gte('issued_at', startOfMonth.slice(0, 10)),

    // last 14 days revenue (delivered shipments) for chart + previous-period delta
    supabase
      .from('shipments')
      .select('price_incl_tax, delivery_actual_at, client_id')
      .eq('company_id', companyId)
      .eq('status', 'delivered')
      .gte('delivery_actual_at', fourteenDaysAgo)
      .is('deleted_at', null),

    supabase
      .from('shipment_status_history')
      .select(`
        id, status, created_at, shipment_id,
        shipment:shipments(reference, driver:drivers(full_name))
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Phase C — Programme du jour : missions prévues entre 00:00 et 23:59
    supabase
      .from('shipments')
      .select('id, reference, status, pickup_city, delivery_city, delivery_scheduled_at, is_jit, client:clients(business_name), driver:drivers(full_name)')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('delivery_scheduled_at', startOfToday)
      .lte('delivery_scheduled_at', endOfToday)
      .order('delivery_scheduled_at', { ascending: true })
      .limit(20),

    // Phase C — Marge sous-traitance du mois (toutes missions hors annulées)
    supabase
      .from('subcontracted_missions')
      .select('cost_excl_tax, sale_excl_tax, margin_excl_tax, status, created_at')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gte('created_at', startOfMonth),

    // Phase C — Missions sous-traitées en cours (sent/accepted/in_progress)
    supabase
      .from('subcontracted_missions')
      .select('id, mission_order_number, status, cost_excl_tax, margin_excl_tax, created_at, subcontractor:subcontractors(name), shipment:shipments(reference, pickup_city, delivery_city)')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .in('status', ['sent', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),

    // Phase C — Alertes critiques : missions JIT en retard
    supabase
      .from('v_jit_at_risk')
      .select('id, reference, client_name, risk_band, minutes_late_now, late_penalty_per_hour_mad, late_tolerance_minutes')
      .eq('company_id', companyId)
      .in('risk_band', ['late', 'critical'])
      .order('delivery_deadline_at', { ascending: true })
      .limit(20),

    // Phase C — Alertes critiques : missions avec dossier douanier incomplet
    supabase
      .from('v_shipment_customs_compliance')
      .select('shipment_id, required_count, uploaded_count, compliance_status')
      .eq('company_id', companyId)
      .in('compliance_status', ['missing', 'partial']),

    // Phase C — CA du mois précédent pour delta + objectif implicite
    supabase
      .from('invoices')
      .select('total_incl_tax, issued_at')
      .eq('company_id', companyId)
      .gte('issued_at', startOfLastMonth.slice(0, 10))
      .lt('issued_at', startOfMonth.slice(0, 10)),
  ])

  const kpis = kpisRes.data
  const activeShipments = activeShipmentsRes.data ?? []
  const overdueInvoices = overdueInvoicesRes.data ?? []

  // Status breakdown
  const statusCounts: Record<ShipmentStatus, number> = {
    created: 0, assigned: 0, picked_up: 0, in_transit: 0,
    customs_clearance: 0, delivered: 0, failed: 0, cancelled: 0,
  }
  let totalShipments = 0
  for (const row of statusCountsRes.data ?? []) {
    if (STATUS_KEYS.includes(row.status as ShipmentStatus)) {
      statusCounts[row.status as ShipmentStatus]++
      totalShipments++
    }
  }

  // Fleet
  const driversTotal = driversRes.data?.length ?? 0
  const driversAvailable = driversRes.data?.filter((d) => d.is_available).length ?? 0
  const vehiclesTotal = vehiclesRes.data?.length ?? 0
  const vehiclesInMaintenance = vehiclesRes.data?.filter((v) => !v.is_available).length ?? 0

  // Pending invoices
  const pendingInvoices = pendingInvoicesRes.data ?? []
  const pendingInvoicesAmount = pendingInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_incl_tax) - Number(inv.amount_paid ?? 0)),
    0,
  )

  // Top clients (revenue from invoices issued this month)
  const monthlyInvoices = monthlyInvoicesRes.data ?? []
  const clientRevenue = new Map<string, { id: string; name: string; revenue: number; shipments: number }>()
  for (const inv of monthlyInvoices) {
    const id = inv.client_id
    if (!id) continue
    const c = inv.client as { business_name: string } | null
    const existing = clientRevenue.get(id)
    if (existing) {
      existing.revenue += Number(inv.total_incl_tax ?? 0)
    } else {
      clientRevenue.set(id, {
        id,
        name: c?.business_name ?? '—',
        revenue: Number(inv.total_incl_tax ?? 0),
        shipments: 0,
      })
    }
  }
  // Count shipments delivered this month per client
  for (const s of recentDeliveriesRes.data ?? []) {
    if (!s.client_id || !s.delivery_actual_at) continue
    if (new Date(s.delivery_actual_at) < new Date(startOfMonth)) continue
    const entry = clientRevenue.get(s.client_id)
    if (entry) entry.shipments++
  }
  const topClients = Array.from(clientRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Revenue trend — daily totals for last 7 days (and previous 7 for delta)
  const dailyRevenue = new Map<string, number>()
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    dailyRevenue.set(dayKey(d), 0)
  }
  for (const s of recentDeliveriesRes.data ?? []) {
    if (!s.delivery_actual_at) continue
    const k = dayKey(new Date(s.delivery_actual_at))
    if (dailyRevenue.has(k)) {
      dailyRevenue.set(k, (dailyRevenue.get(k) ?? 0) + Number(s.price_incl_tax ?? 0))
    }
  }
  const last7: { date: string; amount: number }[] = []
  let totalCurrent = 0
  let totalPrevious = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    const amt = dailyRevenue.get(k) ?? 0
    last7.push({ date: k, amount: amt })
    totalCurrent += amt
  }
  for (let i = 13; i >= 7; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    totalPrevious += dailyRevenue.get(dayKey(d)) ?? 0
  }

  // Activity feed
  const activityItems = (activityRes.data ?? [])
    .map((a) => {
      const ship = a.shipment as
        | { reference: string; driver: { full_name: string } | null }
        | null
      if (!ship) return null
      return {
        id: a.id,
        shipmentId: a.shipment_id,
        reference: ship.reference,
        status: a.status as ShipmentStatus,
        driverName: ship.driver?.full_name ?? null,
        createdAt: a.created_at,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 8)

  const onTimeRate = kpis?.on_time_rate_pct != null
    ? `${kpis.on_time_rate_pct.toFixed(1)}%`
    : '—'

  // ── Phase C — programme du jour ────────────────────────────────
  type TodayProgramRow = {
    id: string
    reference: string
    status: string
    pickup_city: string
    delivery_city: string
    delivery_scheduled_at: string | null
    is_jit: boolean
    client: { business_name: string } | null
    driver: { full_name: string } | null
  }
  const todayProgram = ((todayProgramRes.data ?? []) as unknown as TodayProgramRow[])
  const todayDelivered = todayProgram.filter((s) => s.status === 'delivered').length
  const todayInProgress = todayProgram.filter((s) =>
    ['assigned', 'picked_up', 'in_transit', 'customs_clearance'].includes(s.status),
  ).length

  // ── Phase C — marge sous-traitance du mois ─────────────────────
  type SubMarginRow = { cost_excl_tax: number | string; sale_excl_tax: number | string; margin_excl_tax: number | string; status: string }
  const subMarginRows = ((monthSubMarginRes.data ?? []) as unknown as SubMarginRow[])
  const subMarginMonth = subMarginRows.reduce((s, r) => s + Number(r.margin_excl_tax ?? 0), 0)
  const subRevenueMonth = subMarginRows.reduce((s, r) => s + Number(r.sale_excl_tax ?? 0), 0)
  const subMarginPct = subRevenueMonth > 0 ? (subMarginMonth / subRevenueMonth) * 100 : 0

  // ── Phase C — sous-traitance en cours ──────────────────────────
  type ActiveSubRow = {
    id: string
    mission_order_number: string
    status: string
    cost_excl_tax: number | string
    margin_excl_tax: number | string
    subcontractor: { name: string } | null
    shipment: { reference: string; pickup_city: string; delivery_city: string } | null
  }
  const activeSubcontracts = ((activeSubcontractsRes.data ?? []) as unknown as ActiveSubRow[])

  // ── Phase C — alertes critiques ────────────────────────────────
  type JitAlert = {
    id: string
    reference: string
    client_name: string | null
    risk_band: 'late' | 'critical' | 'warning' | 'on_track' | 'no_deadline'
    minutes_late_now: number
    late_penalty_per_hour_mad: number | string | null
    late_tolerance_minutes: number | null
  }
  const jitAlerts = ((jitAlertsRes.data ?? []) as unknown as JitAlert[])
  const jitLateExposure = jitAlerts
    .filter((a) => a.risk_band === 'late')
    .reduce((sum, a) => {
      const billable = Math.max(0, a.minutes_late_now - (a.late_tolerance_minutes ?? 0))
      if (billable === 0) return sum
      const hours = Math.ceil(billable / 60)
      return sum + hours * Number(a.late_penalty_per_hour_mad ?? 0)
    }, 0)
  const customsAlerts = ((customsAlertsRes.data ?? []) as unknown as Array<{
    shipment_id: string
    required_count: number
    uploaded_count: number
    compliance_status: string
  }>)
  const customsIncomplete = customsAlerts.length
  const lateJit = jitAlerts.filter((a) => a.risk_band === 'late').length
  const criticalJit = jitAlerts.filter((a) => a.risk_band === 'critical').length
  const totalAlerts = lateJit + criticalJit + customsIncomplete

  // ── Phase C — CA du mois + delta vs M-1 ────────────────────────
  const lastMonthRevenue = (lastMonthInvoicesRes.data ?? []).reduce(
    (sum, inv) => sum + Number((inv as { total_incl_tax: number | string }).total_incl_tax ?? 0),
    0,
  )
  const monthRevenue = Number(kpis?.revenue_this_month ?? 0)
  // Implicit target = max(M-1 actual, baseline). Progress shown vs target.
  const monthTarget = Math.max(lastMonthRevenue, 1)
  const monthProgressPct = Math.min(100, Math.round((monthRevenue / monthTarget) * 100))

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${tDash(greetingKey)}${firstName ? ', ' + firstName : ''}`}
        description={tDash('welcomeSubtitle')}
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

      {/* Phase C — Critical alerts banner */}
      {totalAlerts > 0 && (
        <FadeIn delay={0.04}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-bold text-amber-900">
                  {tDash('alerts.title', { count: totalAlerts })}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {lateJit > 0 && (
                    <li className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-rose-600" />
                      <Link href={`/${locale}/jit`} className="hover:underline">
                        {tDash('alerts.lateJit', {
                          count: lateJit,
                          exposure: formatMAD(jitLateExposure),
                        })}
                      </Link>
                    </li>
                  )}
                  {criticalJit > 0 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <Link href={`/${locale}/jit`} className="hover:underline">
                        {tDash('alerts.criticalJit', { count: criticalJit })}
                      </Link>
                    </li>
                  )}
                  {customsIncomplete > 0 && (
                    <li className="flex items-center gap-2">
                      <FileWarning className="h-3.5 w-3.5 text-amber-600" />
                      <Link href={`/${locale}/zones-franches`} className="hover:underline">
                        {tDash('alerts.customsIncomplete', { count: customsIncomplete })}
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Phase C Hero KPIs : Programme du jour · Missions actives · Marge sous-traitance · CA mois (target) */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.08}>
        <StaggerItem>
          <Link href={`/${locale}/shipments?range=today`} className="block focus-ring rounded-xl">
            <KPICard
              title={tDash('phaseC.todayProgram')}
              value={todayProgram.length}
              subtitle={tDash('phaseC.todayProgramSubtitle', {
                done: todayDelivered,
                inProgress: todayInProgress,
              })}
              icon={Calendar}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-100"
            />
          </Link>
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={tDash('phaseC.activeMissions')}
            value={kpis?.active_shipments ?? 0}
            subtitle={tDash('phaseC.activeMissionsSubtitle', {
              onTime: onTimeRate,
              delivered: kpis?.delivered_this_month ?? 0,
            })}
            icon={Truck}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
        <StaggerItem>
          <Link href={`/${locale}/sous-traitance`} className="block focus-ring rounded-xl">
            <KPICard
              title={tDash('phaseC.subMargin')}
              value={formatMAD(subMarginMonth)}
              subtitle={
                subRevenueMonth > 0
                  ? tDash('phaseC.subMarginSubtitle', {
                      pct: subMarginPct.toFixed(1),
                      count: subMarginRows.length,
                    })
                  : tDash('phaseC.subMarginEmpty')
              }
              icon={Handshake}
              iconColor={subMarginMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              iconBg={subMarginMonth >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}
            />
          </Link>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {tDash('phaseC.monthRevenue')}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {formatMAD(monthRevenue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastMonthRevenue > 0
                    ? tDash('phaseC.monthRevenueVsLast', {
                        pct: monthProgressPct,
                        last: formatMAD(lastMonthRevenue),
                      })
                    : tDash('phaseC.monthRevenueNoBaseline')}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--cta))]/10">
                <DollarSign className="h-4 w-4 text-[hsl(var(--cta))]" />
              </div>
            </div>
            {lastMonthRevenue > 0 && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      monthProgressPct >= 100
                        ? 'bg-emerald-500'
                        : monthProgressPct >= 70
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                    }`}
                    style={{ width: `${monthProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </StaggerItem>
      </Stagger>

      {/* Quick stats — clickable mini cards */}
      <QuickStats
        clients={clientsCountRes.count ?? 0}
        drivers={driversTotal}
        vehicles={vehiclesTotal}
        pendingInvoices={pendingInvoices.length}
        pendingInvoicesAmount={pendingInvoicesAmount}
        locale={locale}
        delay={0.18}
      />

      {/* Phase C — Programme du jour + Sous-traitance en cours */}
      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn delay={0.2} className="lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h2 className="font-semibold text-foreground">
                  {tDash('phaseC.todayProgram')}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  {todayProgram.length}
                </span>
              </div>
              <Link
                href={`/${locale}/shipments`}
                className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {tDash('viewAll')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            {todayProgram.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tDash('phaseC.todayProgramEmpty')}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {todayProgram.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/${locale}/shipments/${s.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex w-12 shrink-0 flex-col items-center">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {s.delivery_scheduled_at
                            ? new Date(s.delivery_scheduled_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {s.reference}
                          </span>
                          {s.is_jit && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-200">
                              <Zap className="h-2.5 w-2.5" />
                              JIT
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-sm">
                          {s.client?.business_name ?? '—'}
                          <span className="text-muted-foreground">
                            {' · '}
                            {s.pickup_city} → {s.delivery_city}
                          </span>
                        </p>
                      </div>
                      <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.24}>
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-emerald-600" />
                <h2 className="font-semibold text-foreground">
                  {tDash('phaseC.activeSubcontracts')}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  {activeSubcontracts.length}
                </span>
              </div>
              <Link
                href={`/${locale}/sous-traitance`}
                className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {tDash('viewAll')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            {activeSubcontracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Handshake className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tDash('phaseC.activeSubcontractsEmpty')}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {activeSubcontracts.map((m) => (
                  <li
                    key={m.id}
                    className="px-5 py-3"
                  >
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {m.mission_order_number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tDash(`phaseC.subStatus.${m.status}`)}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.subcontractor?.name ?? '—'}
                      {m.shipment ? ` · ${m.shipment.pickup_city} → ${m.shipment.delivery_city}` : ''}
                    </p>
                    <p className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {tDash('phaseC.subCost', { value: formatMAD(Number(m.cost_excl_tax)) })}
                      </span>
                      <span
                        className={
                          Number(m.margin_excl_tax) > 0
                            ? 'font-semibold text-emerald-700'
                            : Number(m.margin_excl_tax) < 0
                              ? 'font-semibold text-rose-700'
                              : 'text-muted-foreground'
                        }
                      >
                        {tDash('phaseC.subMarginRow', {
                          value: formatMAD(Number(m.margin_excl_tax)),
                        })}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Status + Fleet + Revenue trend */}
      <div className="grid gap-6 lg:grid-cols-3">
        <StatusBreakdown counts={statusCounts} total={totalShipments} delay={0.28} />
        <FleetSnapshot
          driversTotal={driversTotal}
          driversAvailable={driversAvailable}
          vehiclesTotal={vehiclesTotal}
          vehiclesInMaintenance={vehiclesInMaintenance}
          delay={0.32}
        />
        <RevenueTrend
          days={last7}
          totalCurrent={totalCurrent}
          totalPrevious={totalPrevious}
          delay={0.36}
        />
      </div>

      {/* Active shipments + Top clients */}
      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn delay={0.34} className="lg:col-span-2">
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
              {activeShipments.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tShipments('reference')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tShipments('client')}
                      </th>
                      <th className="hidden px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">
                        {tDash('trajet')}
                      </th>
                      <th className="hidden px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                        {tDash('driver')}
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
                        <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                          <span className="inline-flex items-center gap-1.5">
                            {s.pickup_city}
                            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                            {s.delivery_city}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                          {(s.driver as { full_name: string } | null)?.full_name ?? (
                            <span className="italic text-muted-foreground/60">—</span>
                          )}
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
                  <p className="text-sm text-muted-foreground">{tDash('noShipmentsYet')}</p>
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        <TopClients clients={topClients} locale={locale} delay={0.38} />
      </div>

      {/* Overdue invoices + Activity feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn delay={0.42} className="lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-foreground">{tDash('overdueInvoices')}</h2>
              {overdueInvoices.length > 0 && (
                <span className="ms-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                  {overdueInvoices.length}
                </span>
              )}
            </div>
            <div className="divide-y">
              {overdueInvoices.length > 0 ? (
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
            {overdueInvoices.length > 0 && (
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

        <ActivityFeed items={activityItems} locale={locale} delay={0.46} />
      </div>
    </div>
  )
}
