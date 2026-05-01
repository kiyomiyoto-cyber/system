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

interface ShipmentExportRow {
  reference: string
  status: string
  is_jit: boolean
  is_international: boolean
  pickup_city: string
  delivery_city: string
  pickup_scheduled_at: string | null
  delivery_scheduled_at: string | null
  delivery_actual_at: string | null
  weight_kg: number | string | null
  distance_km: number | string | null
  price_excl_tax: number | string | null
  vat_amount: number | string | null
  price_incl_tax: number | string | null
  client: { business_name: string } | null
  driver: { full_name: string } | null
  vehicle: { plate_number: string } | null
  lateness_minutes: number | null
  late_penalty_mad: number | string | null
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
  const fromParam = url.searchParams.get('from') // ISO date
  const toParam = url.searchParams.get('to')
  const statusParam = url.searchParams.get('status')

  const supabase = await createClient()

  let query = supabase
    .from('shipments')
    .select(
      'reference, status, is_jit, is_international, pickup_city, delivery_city, pickup_scheduled_at, delivery_scheduled_at, delivery_actual_at, weight_kg, distance_km, price_excl_tax, vat_amount, price_incl_tax, lateness_minutes, late_penalty_mad, client:clients(business_name), driver:drivers(full_name), vehicle:vehicles(plate_number)',
    )
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('delivery_scheduled_at', { ascending: false })
    .limit(5000)

  if (statusParam) query = query.eq('status', statusParam)
  if (fromParam) query = query.gte('delivery_scheduled_at', fromParam)
  if (toParam) query = query.lte('delivery_scheduled_at', toParam)

  const { data, error } = await query
  if (error) {
    logger.error('exports.shipments.query_failed', {
      action: 'exportShipments',
      companyId: user.companyId,
      error: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = (data ?? []) as unknown as ShipmentExportRow[]

  const { data: companyRaw } = await supabase
    .from('companies')
    .select('name, slug')
    .eq('id', user.companyId)
    .maybeSingle()
  const company = companyRaw as unknown as { name: string; slug: string } | null
  const companyName = company?.name ?? 'TMS'
  const slug = company?.slug ?? 'TMS'

  const columns: ColumnDef<ShipmentExportRow>[] = [
    { header: 'Référence', width: 22, value: (r) => r.reference },
    { header: 'Statut', width: 16, value: (r) => r.status },
    { header: 'JIT', width: 6, align: 'center', value: (r) => (r.is_jit ? 'Oui' : '') },
    { header: 'INT', width: 6, align: 'center', value: (r) => (r.is_international ? 'Oui' : '') },
    { header: 'Client', width: 26, value: (r) => r.client?.business_name ?? '' },
    { header: 'Enlèvement', width: 18, value: (r) => r.pickup_city },
    { header: 'Livraison', width: 18, value: (r) => r.delivery_city },
    {
      header: 'Date prévue',
      width: 18,
      numFmt: FMT.DATETIME,
      value: (r) => (r.delivery_scheduled_at ? new Date(r.delivery_scheduled_at) : null),
    },
    {
      header: 'Date livraison',
      width: 18,
      numFmt: FMT.DATETIME,
      value: (r) => (r.delivery_actual_at ? new Date(r.delivery_actual_at) : null),
    },
    { header: 'Chauffeur', width: 22, value: (r) => r.driver?.full_name ?? '' },
    { header: 'Plaque', width: 12, value: (r) => r.vehicle?.plate_number ?? '' },
    {
      header: 'Distance',
      width: 12,
      numFmt: FMT.KM,
      align: 'right',
      value: (r) => (r.distance_km == null ? null : Number(r.distance_km)),
    },
    {
      header: 'Poids',
      width: 12,
      numFmt: FMT.KG,
      align: 'right',
      value: (r) => (r.weight_kg == null ? null : Number(r.weight_kg)),
    },
    {
      header: 'HT',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.price_excl_tax == null ? null : Number(r.price_excl_tax)),
    },
    {
      header: 'TVA',
      width: 12,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.vat_amount == null ? null : Number(r.vat_amount)),
    },
    {
      header: 'TTC',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.price_incl_tax == null ? null : Number(r.price_incl_tax)),
    },
    {
      header: 'Retard (min)',
      width: 13,
      numFmt: FMT.INT,
      align: 'right',
      value: (r) => r.lateness_minutes ?? null,
    },
    {
      header: 'Pénalité',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.late_penalty_mad == null ? null : Number(r.late_penalty_mad)),
    },
  ]

  // Totals on numeric columns (HT, TVA, TTC, Pénalité, distance, poids)
  const totals = new Map<number, number>()
  let sumHt = 0
  let sumTva = 0
  let sumTtc = 0
  let sumPenalty = 0
  let sumDist = 0
  let sumWeight = 0
  for (const r of rows) {
    sumHt += Number(r.price_excl_tax ?? 0)
    sumTva += Number(r.vat_amount ?? 0)
    sumTtc += Number(r.price_incl_tax ?? 0)
    sumPenalty += Number(r.late_penalty_mad ?? 0)
    sumDist += Number(r.distance_km ?? 0)
    sumWeight += Number(r.weight_kg ?? 0)
  }
  totals.set(11, sumDist) // Distance
  totals.set(12, sumWeight) // Poids
  totals.set(13, sumHt) // HT
  totals.set(14, sumTva) // TVA
  totals.set(15, sumTtc) // TTC
  totals.set(17, sumPenalty) // Pénalité

  const subtitle = (() => {
    const parts: string[] = []
    if (fromParam || toParam) {
      parts.push(`Période : ${fromParam ?? '…'} → ${toParam ?? '…'}`)
    }
    if (statusParam) parts.push(`Statut : ${statusParam}`)
    parts.push(`${rows.length} mission(s)`)
    return parts.join(' · ')
  })()

  const buf = await buildWorkbook([
    {
      name: 'Missions',
      meta: {
        title: 'Missions',
        subtitle,
        companyName,
        generatedAt: new Date().toISOString(),
      },
      columns,
      rows,
      totals: { label: 'Totaux', values: totals },
    },
  ])

  const filename = buildExportFilename(slug, 'MISSIONS')
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
