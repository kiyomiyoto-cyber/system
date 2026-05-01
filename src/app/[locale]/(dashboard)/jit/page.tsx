import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Zap } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ExcelExportLink } from '@/components/shared/excel-export-link'
import { JitView, type AtRiskRow, type RecentLateRow, type ClientPolicyRow } from './jit-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface AtRiskRaw {
  id: string
  reference: string
  client_id: string
  client_name: string | null
  status: string
  pickup_city: string
  delivery_city: string
  delivery_scheduled_at: string | null
  delivery_deadline_at: string | null
  late_penalty_per_hour_mad: number | string | null
  late_tolerance_minutes: number | null
  risk_band: string
  minutes_late_now: number
}

interface ShipmentLateRaw {
  id: string
  reference: string
  status: string
  delivery_actual_at: string | null
  delivery_deadline_at: string | null
  lateness_minutes: number | null
  late_penalty_mad: number | string | null
  client: { business_name: string } | null
}

interface ClientPolicyRaw {
  id: string
  business_name: string
  delivery_window_strict: boolean
  late_penalty_per_hour_mad: number | string
  late_tolerance_minutes: number
  is_active: boolean
}

export default async function JitPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('jit'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [atRiskResult, recentLateResult, clientsResult] = await Promise.all([
    supabase
      .from('v_jit_at_risk')
      .select(
        'id, reference, client_id, client_name, status, pickup_city, delivery_city, delivery_scheduled_at, delivery_deadline_at, late_penalty_per_hour_mad, late_tolerance_minutes, risk_band, minutes_late_now',
      )
      .eq('company_id', user.companyId)
      .order('delivery_deadline_at', { ascending: true })
      .limit(100),
    // Last 30 days of completed JIT missions, including the on-time ones
    // for context.
    supabase
      .from('shipments')
      .select(
        'id, reference, status, delivery_actual_at, delivery_deadline_at, lateness_minutes, late_penalty_mad, client:clients(business_name)',
      )
      .eq('company_id', user.companyId)
      .eq('is_jit', true)
      .eq('status', 'delivered')
      .gte('delivery_actual_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .is('deleted_at', null)
      .order('delivery_actual_at', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, business_name, delivery_window_strict, late_penalty_per_hour_mad, late_tolerance_minutes, is_active')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('delivery_window_strict', { ascending: false })
      .order('business_name', { ascending: true }),
  ])

  const atRisk = ((atRiskResult.data ?? []) as unknown as AtRiskRaw[])
  const recent = ((recentLateResult.data ?? []) as unknown as ShipmentLateRaw[])
  const clients = ((clientsResult.data ?? []) as unknown as ClientPolicyRaw[])

  const atRiskRows: AtRiskRow[] = atRisk.map((r) => ({
    id: r.id,
    reference: r.reference,
    clientId: r.client_id,
    clientName: r.client_name ?? '—',
    status: r.status,
    pickupCity: r.pickup_city,
    deliveryCity: r.delivery_city,
    deliveryScheduledAt: r.delivery_scheduled_at,
    deliveryDeadlineAt: r.delivery_deadline_at,
    latePenaltyPerHourMad:
      r.late_penalty_per_hour_mad == null ? 0 : Number(r.late_penalty_per_hour_mad),
    lateToleranceMinutes: r.late_tolerance_minutes ?? 0,
    riskBand: r.risk_band as AtRiskRow['riskBand'],
    minutesLateNow: r.minutes_late_now,
  }))

  const recentRows: RecentLateRow[] = recent.map((r) => ({
    id: r.id,
    reference: r.reference,
    clientName: r.client?.business_name ?? '—',
    deliveryActualAt: r.delivery_actual_at,
    deliveryDeadlineAt: r.delivery_deadline_at,
    latenessMinutes: r.lateness_minutes,
    latePenaltyMad: r.late_penalty_mad == null ? 0 : Number(r.late_penalty_mad),
  }))

  const clientRows: ClientPolicyRow[] = clients.map((c) => ({
    id: c.id,
    businessName: c.business_name,
    isActive: c.is_active,
    deliveryWindowStrict: c.delivery_window_strict,
    latePenaltyPerHourMad: Number(c.late_penalty_per_hour_mad),
    lateToleranceMinutes: c.late_tolerance_minutes,
  }))

  const totalExposureNow = atRiskRows.reduce((sum, r) => {
    if (r.riskBand !== 'late') return sum
    const billable = Math.max(0, r.minutesLateNow - r.lateToleranceMinutes)
    if (billable === 0) return sum
    const hours = Math.ceil(billable / 60)
    return sum + hours * r.latePenaltyPerHourMad
  }, 0)
  const last30dPenalty = recentRows.reduce((sum, r) => sum + r.latePenaltyMad, 0)

  const canEdit =
    user.role === 'super_admin' || user.role === 'company_admin' || user.role === 'dispatcher'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <ExcelExportLink href="/api/exports/jit?days=30" label={t('page.exportExcel')} />
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <Zap className="h-3.5 w-3.5" />
              {t('page.strictClients', {
                count: clientRows.filter((c) => c.deliveryWindowStrict && c.isActive).length,
              })}
            </span>
          </div>
        }
      />

      <JitView
        atRisk={atRiskRows}
        recent={recentRows}
        clients={clientRows}
        canEdit={canEdit}
        totalExposureNow={totalExposureNow}
        last30dPenalty={last30dPenalty}
      />
    </div>
  )
}
