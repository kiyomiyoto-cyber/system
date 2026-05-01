import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { InvoicePDF } from '@/lib/pdf/invoice-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = user.companyId

  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(business_name, address, city, tax_id, payment_terms_days),
      company:companies(name, address, city, phone, email, tax_id)
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Authorization: clients only see their own invoices
  if (user.role === 'client') {
    const { data: clientRecord } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!clientRecord || clientRecord.id !== invoice.client_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Resolve linked shipments via the join table.
  const { data: shipmentLinks } = await supabase
    .from('invoice_shipments')
    .select('shipment_id')
    .eq('invoice_id', id)
  const linkedIds = (shipmentLinks ?? []).map((l) => l.shipment_id)

  const { data: shipments } = linkedIds.length > 0
    ? await supabase
        .from('shipments')
        .select('reference, pickup_city, delivery_city, distance_km, price_excl_tax')
        .in('id', linkedIds)
    : { data: [] as Array<{ reference: string; pickup_city: string; delivery_city: string; distance_km: number | null; price_excl_tax: number | null }> }

  const companyRow = invoice.company as { name: string; address: string | null; city: string; phone: string | null; email: string | null; tax_id: string | null }
  const clientRow = invoice.client as { business_name: string; address: string | null; city: string; tax_id: string | null; payment_terms_days: number }

  // PDF generator still uses `ice` keys; map tax_id → ice at the boundary so the
  // template doesn't have to change.
  const company = { ...companyRow, ice: companyRow.tax_id }
  const client = { business_name: clientRow.business_name, address: clientRow.address, city: clientRow.city, ice: clientRow.tax_id }

  const pdfBuffer = await renderToBuffer(
    InvoicePDF({
      data: {
        invoiceNumber: invoice.invoice_number,
        issueDate: invoice.issued_at,
        dueDate: invoice.due_at,
        paymentTermsDays: clientRow.payment_terms_days,
        company,
        client,
        shipments: (shipments ?? []).map((s) => ({
          reference: s.reference,
          pickup_city: s.pickup_city,
          delivery_city: s.delivery_city,
          distance_km: Number(s.distance_km ?? 0),
          price_excl_tax: Number(s.price_excl_tax ?? 0),
        })),
        subtotal: Number(invoice.subtotal_excl_tax),
        vatAmount: Number(invoice.tax_amount),
        totalAmount: Number(invoice.total_incl_tax),
      },
    })
  )

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
