import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Radio } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CommandCenterView, type CommandSnapshot } from './command-center-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher']

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'in_transit', 'customs_clearance'] as const

export const dynamic = 'force-dynamic'

export default async function CentreCommandementPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('commandCenter'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)
  const companyId = user.companyId

  const supabase = await createClient()
  const startOfToday = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const endOfToday = (() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  })()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    activeRes,
    deliveredTodayRes,
    todayProgramRes,
    driversRes,
    workSessionsRes,
    jitRes,
    customsRes,
    activityRes,
  ] = await Promise.all([
    // Live missions board — anything currently in-flight, regardless of date
    supabase
      .from('shipments')
      .select(
        'id, reference, status, pickup_city, delivery_city, pickup_scheduled_at, delivery_scheduled_at, delivery_deadline_at, is_jit, is_international, updated_at, client:clients(business_name), driver:drivers(id, full_name, phone, whatsapp_phone), vehicle:vehicles(plate_number)',
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .order('delivery_deadline_at', { ascending: true, nullsFirst: false })
      .limit(40),

    // Delivered today (4th kanban column)
    supabase
      .from('shipments')
      .select(
        'id, reference, status, pickup_city, delivery_city, delivery_actual_at, delivery_deadline_at, lateness_minutes, is_jit, client:clients(business_name), driver:drivers(full_name)',
      )
      .eq('company_id', companyId)
      .eq('status', 'delivered')
      .gte('delivery_actual_at', startOfToday)
      .lte('delivery_actual_at', endOfToday)
      .is('deleted_at', null)
      .order('delivery_actual_at', { ascending: false })
      .limit(20),

    // Today's schedule timeline (planned + delivered + active)
    supabase
      .from('shipments')
      .select(
        'id, reference, status, pickup_city, delivery_city, delivery_scheduled_at, is_jit, client:clients(business_name)',
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('delivery_scheduled_at', startOfToday)
      .lte('delivery_scheduled_at', endOfToday)
      .order('delivery_scheduled_at', { ascending: true })
      .limit(40),

    // All active drivers in the company
    supabase
      .from('drivers')
      .select('id, full_name, phone, whatsapp_phone, is_available')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name', { ascending: true }),

    // Open work sessions (= currently checked-in team members) + last 24h of closed ones
    supabase
      .from('work_sessions')
      .select(
        'id, user_id, role, check_in_at, check_out_at, user:users!work_sessions_user_id_fkey(full_name, role, avatar_url)',
      )
      .eq('company_id', companyId)
      .gte('check_in_at', since24h)
      .order('check_in_at', { ascending: false })
      .limit(50),

    // JIT alerts (late + critical only)
    supabase
      .from('v_jit_at_risk')
      .select(
        'id, reference, client_name, risk_band, minutes_late_now, late_penalty_per_hour_mad, late_tolerance_minutes, delivery_deadline_at',
      )
      .eq('company_id', companyId)
      .in('risk_band', ['late', 'critical'])
      .order('delivery_deadline_at', { ascending: true })
      .limit(20),

    // Customs incomplete (international + missing docs)
    supabase
      .from('v_shipment_customs_compliance')
      .select('shipment_id, required_count, uploaded_count, compliance_status')
      .eq('company_id', companyId)
      .in('compliance_status', ['missing', 'partial'])
      .limit(20),

    // Last status changes (recent activity ticker)
    supabase
      .from('shipment_status_history')
      .select(
        'id, status, created_at, shipment_id, shipment:shipments(reference, driver:drivers(full_name))',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  type ActiveRow = {
    id: string
    reference: string
    status: 'assigned' | 'picked_up' | 'in_transit' | 'customs_clearance'
    pickup_city: string
    delivery_city: string
    pickup_scheduled_at: string | null
    delivery_scheduled_at: string | null
    delivery_deadline_at: string | null
    is_jit: boolean
    is_international: boolean
    updated_at: string
    client: { business_name: string } | null
    driver: {
      id: string
      full_name: string
      phone: string
      whatsapp_phone: string | null
    } | null
    vehicle: { plate_number: string } | null
  }
  type DeliveredRow = {
    id: string
    reference: string
    status: 'delivered'
    pickup_city: string
    delivery_city: string
    delivery_actual_at: string | null
    delivery_deadline_at: string | null
    lateness_minutes: number | null
    is_jit: boolean
    client: { business_name: string } | null
    driver: { full_name: string } | null
  }
  type TodayRow = {
    id: string
    reference: string
    status: string
    pickup_city: string
    delivery_city: string
    delivery_scheduled_at: string | null
    is_jit: boolean
    client: { business_name: string } | null
  }
  type DriverRow = {
    id: string
    full_name: string
    phone: string
    whatsapp_phone: string | null
    is_available: boolean
  }
  type WorkSessionRow = {
    id: string
    user_id: string
    role: string
    check_in_at: string
    check_out_at: string | null
    user: { full_name: string; role: string; avatar_url: string | null } | null
  }
  type JitRow = {
    id: string
    reference: string
    client_name: string | null
    risk_band: 'late' | 'critical'
    minutes_late_now: number
    late_penalty_per_hour_mad: number | string | null
    late_tolerance_minutes: number | null
    delivery_deadline_at: string | null
  }
  type CustomsRow = {
    shipment_id: string
    required_count: number
    uploaded_count: number
    compliance_status: 'missing' | 'partial'
  }
  type ActivityRow = {
    id: string
    status: string
    created_at: string
    shipment_id: string
    shipment: { reference: string; driver: { full_name: string } | null } | null
  }

  const active = (activeRes.data ?? []) as unknown as ActiveRow[]
  const delivered = (deliveredTodayRes.data ?? []) as unknown as DeliveredRow[]
  const todayProgram = (todayProgramRes.data ?? []) as unknown as TodayRow[]
  const drivers = (driversRes.data ?? []) as unknown as DriverRow[]
  const workSessions = (workSessionsRes.data ?? []) as unknown as WorkSessionRow[]
  const jit = (jitRes.data ?? []) as unknown as JitRow[]
  const customs = (customsRes.data ?? []) as unknown as CustomsRow[]
  const activity = (activityRes.data ?? []) as unknown as ActivityRow[]

  // Driver → currently-active mission lookup
  const driverActiveMission = new Map<
    string,
    { reference: string; deliveryCity: string; status: string }
  >()
  for (const m of active) {
    if (m.driver?.id && !driverActiveMission.has(m.driver.id)) {
      driverActiveMission.set(m.driver.id, {
        reference: m.reference,
        deliveryCity: m.delivery_city,
        status: m.status,
      })
    }
  }

  // Estimated late exposure (only count `late` band, billable above tolerance)
  const lateExposureMad = jit
    .filter((j) => j.risk_band === 'late')
    .reduce((sum, j) => {
      const billable = Math.max(0, j.minutes_late_now - (j.late_tolerance_minutes ?? 0))
      if (billable === 0) return sum
      const hours = Math.ceil(billable / 60)
      return sum + hours * Number(j.late_penalty_per_hour_mad ?? 0)
    }, 0)

  const snapshot: CommandSnapshot = {
    companyId,
    locale,
    serverNowIso: new Date().toISOString(),
    activeMissions: active.map((m) => ({
      id: m.id,
      reference: m.reference,
      status: m.status,
      pickupCity: m.pickup_city,
      deliveryCity: m.delivery_city,
      pickupScheduledAt: m.pickup_scheduled_at,
      deliveryScheduledAt: m.delivery_scheduled_at,
      deliveryDeadlineAt: m.delivery_deadline_at,
      isJit: m.is_jit,
      isInternational: m.is_international,
      updatedAt: m.updated_at,
      clientName: m.client?.business_name ?? null,
      driver: m.driver
        ? {
            id: m.driver.id,
            fullName: m.driver.full_name,
            phone: m.driver.phone,
            whatsappPhone: m.driver.whatsapp_phone,
          }
        : null,
      vehiclePlate: m.vehicle?.plate_number ?? null,
    })),
    deliveredToday: delivered.map((m) => ({
      id: m.id,
      reference: m.reference,
      pickupCity: m.pickup_city,
      deliveryCity: m.delivery_city,
      deliveryActualAt: m.delivery_actual_at,
      deliveryDeadlineAt: m.delivery_deadline_at,
      latenessMinutes: m.lateness_minutes,
      isJit: m.is_jit,
      clientName: m.client?.business_name ?? null,
      driverName: m.driver?.full_name ?? null,
    })),
    todayProgram: todayProgram.map((s) => ({
      id: s.id,
      reference: s.reference,
      status: s.status,
      pickupCity: s.pickup_city,
      deliveryCity: s.delivery_city,
      deliveryScheduledAt: s.delivery_scheduled_at,
      isJit: s.is_jit,
      clientName: s.client?.business_name ?? null,
    })),
    drivers: drivers.map((d) => {
      const mission = driverActiveMission.get(d.id) ?? null
      return {
        id: d.id,
        fullName: d.full_name,
        phone: d.phone,
        whatsappPhone: d.whatsapp_phone,
        isAvailable: d.is_available,
        currentMission: mission,
      }
    }),
    workSessions: workSessions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      role: s.role,
      checkInAt: s.check_in_at,
      checkOutAt: s.check_out_at,
      userName: s.user?.full_name ?? null,
      userRole: s.user?.role ?? s.role,
    })),
    jitAlerts: jit.map((j) => ({
      id: j.id,
      reference: j.reference,
      clientName: j.client_name,
      riskBand: j.risk_band,
      minutesLateNow: j.minutes_late_now,
      latePenaltyPerHourMad: Number(j.late_penalty_per_hour_mad ?? 0),
      lateToleranceMinutes: j.late_tolerance_minutes ?? 0,
      deliveryDeadlineAt: j.delivery_deadline_at,
    })),
    customsAlerts: customs.map((c) => ({
      shipmentId: c.shipment_id,
      requiredCount: c.required_count,
      uploadedCount: c.uploaded_count,
      complianceStatus: c.compliance_status,
    })),
    activity: activity
      .filter((a) => a.shipment !== null)
      .map((a) => ({
        id: a.id,
        status: a.status,
        createdAt: a.created_at,
        shipmentId: a.shipment_id,
        reference: a.shipment!.reference,
        driverName: a.shipment!.driver?.full_name ?? null,
      })),
    lateExposureMad,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {t('page.live')}
          </span>
        }
      />
      <CommandCenterView snapshot={snapshot} />
    </div>
  )
}
