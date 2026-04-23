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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(business_name, address, city, ice),
      company:companies(name, address, city, phone, email, ice)
    `)
    .eq('id', id)
    .eq('company_id', user.companyId)
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

  const { data: shipments } = await supabase
    .from('shipments')
    .select('reference, pickup_city, delivery_city, distance_km, price_excl_tax')
    .in('id', (invoice.shipment_ids ?? []) as string[])

  const company = invoice.company as { name: string; address: string | null; city: string; phone: string | null; email: string | null; ice: string | null }
  const client = invoice.client as { business_name: string; address: string | null; city: string; ice: string | null }

  const pdfBuffer = await renderToBuffer(
    InvoicePDF({
      data: {
        invoiceNumber: invoice.invoice_number,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        paymentTermsDays: invoice.payment_terms_days,
        company,
        client,
        shipments: (shipments ?? []).map((s) => ({
          reference: s.reference,
          pickup_city: s.pickup_city,
          delivery_city: s.delivery_city,
          distance_km: s.distance_km ?? 0,
          price_excl_tax: s.price_excl_tax ?? 0,
        })),
        subtotal: invoice.subtotal,
        vatAmount: invoice.vat_amount,
        totalAmount: invoice.total_amount,
      },
    })
  )

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
