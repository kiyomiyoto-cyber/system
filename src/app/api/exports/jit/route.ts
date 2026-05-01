import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import {
  buildExportFilename,
  buildWorkbook,
  FMT,
  type ColumnDef,
} from '@/lib/excel/workbook'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface JitDeliveredRow {
  reference: string
  delivery_actual_at: string | null
  delivery_deadline_at: string | null
  lateness_minutes: number | null
  late_penalty_mad: number | string | null
  pickup_city: string
  delivery_city: string
  client: { business_name: string } | null
  driver: { full_name: string } | null
}

interface JitAtRiskRow {
  reference: string
  client_name: string | null
  status: string
  pickup_city: string
  delivery_city: string
  delivery_deadline_at: string | null
  risk_band: string
  minutes_late_now: number
  late_penalty_per_hour_mad: number | string | null
  late_tolerance_minutes: number | null
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const days = Math.max(7, Math.min(365, Number(url.searchParams.get('days') ?? 30)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()

  const [deliveredRes, atRiskRes, companyRes] = await Promise.all([
    supabase
      .from('shipments')
      .select(
        'reference, delivery_actual_at, delivery_deadline_at, lateness_minutes, late_penalty_mad, pickup_city, delivery_city, client:clients(business_name), driver:drivers(full_name)',
      )
      .eq('company_id', user.companyId)
      .eq('is_jit', true)
      .eq('status', 'delivered')
      .gte('delivery_actual_at', since)
      .is('deleted_at', null)
      .order('delivery_actual_at', { ascending: false })
      .limit(2000),
    supabase
      .from('v_jit_at_risk')
      .select(
        'reference, client_name, status, pickup_city, delivery_city, delivery_deadline_at, risk_band, minutes_late_now, late_penalty_per_hour_mad, late_tolerance_minutes',
      )
      .eq('company_id', user.companyId)
      .order('delivery_deadline_at', { ascending: true })
      .limit(500),
    supabase
      .from('companies')
      .select('name, slug')
      .eq('id', user.companyId)
      .maybeSingle(),
  ])

  if (deliveredRes.error || atRiskRes.error) {
    const msg = deliveredRes.error?.message ?? atRiskRes.error?.message ?? 'Échec.'
    logger.error('exports.jit.query_failed', {
      action: 'exportJit',
      companyId: user.companyId,
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const delivered = (deliveredRes.data ?? []) as unknown as JitDeliveredRow[]
  const atRisk = (atRiskRes.data ?? []) as unknown as JitAtRiskRow[]
  const company = companyRes.data as unknown as { name: string; slug: string } | null
  const companyName = company?.name ?? 'TMS'
  const slug = company?.slug ?? 'TMS'

  // Sheet 1: closed JIT missions over the period (compliance log)
  const deliveredCols: ColumnDef<JitDeliveredRow>[] = [
    { header: 'Référence', width: 22, value: (r) => r.reference },
    { header: 'Client', width: 22, value: (r) => r.client?.business_name ?? '' },
    { header: 'Trajet', width: 28, value: (r) => `${r.pickup_city} → ${r.delivery_city}` },
    {
      header: 'Échéance',
      width: 18,
      numFmt: FMT.DATETIME,
      value: (r) => (r.delivery_deadline_at ? new Date(r.delivery_deadline_at) : null),
    },
    {
      header: 'Livré le',
      width: 18,
      numFmt: FMT.DATETIME,
      value: (r) => (r.delivery_actual_at ? new Date(r.delivery_actual_at) : null),
    },
    {
      header: 'Retard (min)',
      width: 13,
      numFmt: FMT.INT,
      align: 'right',
      value: (r) => r.lateness_minutes ?? 0,
    },
    {
      header: 'Pénalité',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.late_penalty_mad == null ? 0 : Number(r.late_penalty_mad)),
    },
    { header: 'Chauffeur', width: 22, value: (r) => r.driver?.full_name ?? '' },
  ]

  const totalsDelivered = new Map<number, number>()
  let sumPenalty = 0
  let sumLatenessMin = 0
  for (const r of delivered) {
    sumPenalty += Number(r.late_penalty_mad ?? 0)
    sumLatenessMin += Number(r.lateness_minutes ?? 0)
  }
  totalsDelivered.set(5, sumLatenessMin)
  totalsDelivered.set(6, sumPenalty)

  // Sheet 2: live at-risk view (snapshot)
  const atRiskCols: ColumnDef<JitAtRiskRow>[] = [
    { header: 'Référence', width: 22, value: (r) => r.reference },
    { header: 'Client', width: 22, value: (r) => r.client_name ?? '' },
    { header: 'Statut', width: 14, value: (r) => r.status },
    { header: 'Trajet', width: 28, value: (r) => `${r.pickup_city} → ${r.delivery_city}` },
    {
      header: 'Échéance',
      width: 18,
      numFmt: FMT.DATETIME,
      value: (r) => (r.delivery_deadline_at ? new Date(r.delivery_deadline_at) : null),
    },
    { header: 'Risque', width: 12, value: (r) => r.risk_band },
    {
      header: 'Retard maintenant (min)',
      width: 22,
      numFmt: FMT.INT,
      align: 'right',
      value: (r) => r.minutes_late_now,
    },
    {
      header: 'Pénalité / h',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) =>
        r.late_penalty_per_hour_mad == null ? 0 : Number(r.late_penalty_per_hour_mad),
    },
    {
      header: 'Tolérance (min)',
      width: 14,
      numFmt: FMT.INT,
      align: 'right',
      value: (r) => r.late_tolerance_minutes ?? 0,
    },
  ]

  const buf = await buildWorkbook([
    {
      name: 'JIT livrées',
      meta: {
        title: `Missions JIT livrées (${days} derniers jours)`,
        subtitle: `${delivered.length} mission(s) · pénalités totales : ${sumPenalty.toLocaleString('fr-MA')} MAD`,
        companyName,
        generatedAt: new Date().toISOString(),
      },
      columns: deliveredCols,
      rows: delivered,
      totals: { label: 'Totaux', values: totalsDelivered },
    },
    {
      name: 'JIT à risque',
      meta: {
        title: 'Missions JIT à risque (instantané)',
        subtitle: `${atRisk.length} mission(s) — vue temps réel`,
        companyName,
        generatedAt: new Date().toISOString(),
      },
      columns: atRiskCols,
      rows: atRisk,
    },
  ])

  const filename = buildExportFilename(slug, 'JIT')
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
