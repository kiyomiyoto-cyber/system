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

interface InvoiceExportRow {
  invoice_number: string
  status: string
  issued_at: string | null
  due_date: string | null
  total_excl_tax: number | string | null
  vat_amount: number | string | null
  total_incl_tax: number | string | null
  amount_paid: number | string | null
  client: { business_name: string; tax_id: string | null } | null
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
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const statusParam = url.searchParams.get('status')

  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(
      'invoice_number, status, issued_at, due_date, total_excl_tax, vat_amount, total_incl_tax, amount_paid, client:clients(business_name, tax_id)',
    )
    .eq('company_id', user.companyId)
    .order('issued_at', { ascending: false })
    .limit(5000)

  if (statusParam) query = query.eq('status', statusParam)
  if (fromParam) query = query.gte('issued_at', fromParam)
  if (toParam) query = query.lte('issued_at', toParam)

  const { data, error } = await query
  if (error) {
    logger.error('exports.invoices.query_failed', {
      action: 'exportInvoices',
      companyId: user.companyId,
      error: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = (data ?? []) as unknown as InvoiceExportRow[]

  const { data: companyRaw } = await supabase
    .from('companies')
    .select('name, slug')
    .eq('id', user.companyId)
    .maybeSingle()
  const company = companyRaw as unknown as { name: string; slug: string } | null
  const companyName = company?.name ?? 'TMS'
  const slug = company?.slug ?? 'TMS'

  const columns: ColumnDef<InvoiceExportRow>[] = [
    { header: 'N° facture', width: 22, value: (r) => r.invoice_number },
    { header: 'Statut', width: 14, value: (r) => r.status },
    {
      header: 'Émise le',
      width: 14,
      numFmt: FMT.DATE,
      value: (r) => (r.issued_at ? new Date(r.issued_at) : null),
    },
    {
      header: 'Échéance',
      width: 14,
      numFmt: FMT.DATE,
      value: (r) => (r.due_date ? new Date(r.due_date) : null),
    },
    { header: 'Client', width: 28, value: (r) => r.client?.business_name ?? '' },
    { header: 'ICE client', width: 18, value: (r) => r.client?.tax_id ?? '' },
    {
      header: 'HT',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.total_excl_tax == null ? null : Number(r.total_excl_tax)),
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
      value: (r) => (r.total_incl_tax == null ? null : Number(r.total_incl_tax)),
    },
    {
      header: 'Réglé',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) => (r.amount_paid == null ? null : Number(r.amount_paid)),
    },
    {
      header: 'Solde',
      width: 14,
      numFmt: FMT.MAD,
      align: 'right',
      value: (r) =>
        Number(r.total_incl_tax ?? 0) - Number(r.amount_paid ?? 0),
    },
  ]

  const totals = new Map<number, number>()
  let sumHt = 0
  let sumTva = 0
  let sumTtc = 0
  let sumPaid = 0
  let sumBalance = 0
  for (const r of rows) {
    sumHt += Number(r.total_excl_tax ?? 0)
    sumTva += Number(r.vat_amount ?? 0)
    sumTtc += Number(r.total_incl_tax ?? 0)
    sumPaid += Number(r.amount_paid ?? 0)
    sumBalance += Number(r.total_incl_tax ?? 0) - Number(r.amount_paid ?? 0)
  }
  totals.set(6, sumHt)
  totals.set(7, sumTva)
  totals.set(8, sumTtc)
  totals.set(9, sumPaid)
  totals.set(10, sumBalance)

  const subtitle = (() => {
    const parts: string[] = []
    if (fromParam || toParam) {
      parts.push(`Période : ${fromParam ?? '…'} → ${toParam ?? '…'}`)
    }
    if (statusParam) parts.push(`Statut : ${statusParam}`)
    parts.push(`${rows.length} facture(s)`)
    return parts.join(' · ')
  })()

  const buf = await buildWorkbook([
    {
      name: 'Factures',
      meta: {
        title: 'Factures',
        subtitle,
        companyName,
        generatedAt: new Date().toISOString(),
      },
      columns,
      rows,
      totals: { label: 'Totaux', values: totals },
    },
  ])

  const filename = buildExportFilename(slug, 'FACTURES')
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
