'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert } from '@/types/database.types'

// Per the schema (20240101000000_initial_schema.sql), invoices has:
//   subtotal_excl_tax, tax_amount, tax_rate, total_incl_tax, amount_paid,
//   issued_at, due_at, status, ...
// Shipment links live in the invoice_shipments join table — there is no
// shipment_ids array column on invoices. payment_terms_days lives on
// clients.payment_terms_days; it is NOT stored on invoices.

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDatePlusDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function generateInvoiceForShipment(
  shipmentId: string,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: shipmentRaw } = await supabase
    .from('shipments')
    .select('id, client_id, price_excl_tax, tax_amount, price_incl_tax, status, client:clients(id, business_name, payment_terms_days, billing_mode)')
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .eq('status', 'delivered')
    .is('deleted_at', null)
    .maybeSingle()

  type ShipmentRow = {
    id: string
    client_id: string
    price_excl_tax: number | null
    tax_amount: number | null
    price_incl_tax: number | null
    client: { id: string; business_name: string; payment_terms_days: number; billing_mode: string } | null
  }
  const shipment = shipmentRaw as unknown as ShipmentRow | null
  if (!shipment) return { data: null, error: 'Shipment not found or not delivered' }

  // Reject if this shipment is already invoiced.
  const { data: existingLink } = await supabase
    .from('invoice_shipments')
    .select('invoice_id')
    .eq('shipment_id', shipmentId)
    .limit(1)
    .maybeSingle()
  if (existingLink) return { data: null, error: 'Invoice already exists for this shipment' }

  const { data: seqData } = await supabase.rpc('next_sequence_value', {
    p_company_id: user.companyId,
    p_type: 'invoice',
  })
  const year = new Date().getFullYear()
  const invoiceNumber = `FAC-${year}-${String(seqData ?? 1).padStart(4, '0')}`

  const paymentTermsDays = shipment.client?.payment_terms_days ?? 30

  const subtotal = Number(shipment.price_excl_tax ?? 0)
  const taxAmount = Number(shipment.tax_amount ?? 0)
  const total = Number(shipment.price_incl_tax ?? 0)
  // vat_rate isn't a column on shipments — derive from amounts, default to 20% Morocco standard.
  const taxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 20

  const insert: TablesInsert<'invoices'> = {
    company_id: user.companyId,
    invoice_number: invoiceNumber,
    client_id: shipment.client_id,
    issued_at: isoDateToday(),
    due_at: isoDatePlusDays(paymentTermsDays),
    subtotal_excl_tax: subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_incl_tax: total,
    amount_paid: 0,
    status: 'unpaid',
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(insert)
    .select('id, invoice_number')
    .single()

  if (error || !invoice) return { data: null, error: error?.message ?? 'Insert failed' }

  // Link the shipment via the join table.
  const { error: linkError } = await supabase
    .from('invoice_shipments')
    .insert({ invoice_id: invoice.id, shipment_id: shipmentId })
  if (linkError) {
    // Rollback: drop the invoice we just created so we don't leak orphans.
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { data: null, error: linkError.message }
  }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  return { data: { id: invoice.id, invoiceNumber: invoice.invoice_number }, error: null }
}

export async function generateGroupedInvoice(
  clientId: string,
  shipmentIds: string[],
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }
  if (shipmentIds.length === 0) return { data: null, error: 'No shipments selected' }

  const supabase = await createClient()

  const { data: shipmentsRaw } = await supabase
    .from('shipments')
    .select('id, price_excl_tax, tax_amount, price_incl_tax')
    .eq('company_id', user.companyId)
    .eq('client_id', clientId)
    .eq('status', 'delivered')
    .in('id', shipmentIds)
    .is('deleted_at', null)

  type ShipmentRow = {
    id: string
    price_excl_tax: number | null
    tax_amount: number | null
    price_incl_tax: number | null
  }
  const shipments = (shipmentsRaw ?? []) as unknown as ShipmentRow[]
  if (shipments.length === 0) {
    return { data: null, error: 'No eligible shipments found' }
  }

  // Refuse to re-invoice any shipment already linked.
  const { data: alreadyLinked } = await supabase
    .from('invoice_shipments')
    .select('shipment_id')
    .in('shipment_id', shipmentIds)
  if (alreadyLinked && alreadyLinked.length > 0) {
    return { data: null, error: 'One or more shipments are already invoiced' }
  }

  const subtotal = shipments.reduce((s, sh) => s + Number(sh.price_excl_tax ?? 0), 0)
  const taxAmount = shipments.reduce((s, sh) => s + Number(sh.tax_amount ?? 0), 0)
  const total = shipments.reduce((s, sh) => s + Number(sh.price_incl_tax ?? 0), 0)
  // Derive effective rate from the aggregate; default to 20% Morocco standard.
  const taxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 20

  const { data: clientData } = await supabase
    .from('clients')
    .select('payment_terms_days')
    .eq('id', clientId)
    .single()
  const paymentTermsDays = clientData?.payment_terms_days ?? 30

  const { data: seqData } = await supabase.rpc('next_sequence_value', {
    p_company_id: user.companyId,
    p_type: 'invoice',
  })
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(seqData ?? 1).padStart(4, '0')}`

  const insert: TablesInsert<'invoices'> = {
    company_id: user.companyId,
    invoice_number: invoiceNumber,
    client_id: clientId,
    issued_at: isoDateToday(),
    due_at: isoDatePlusDays(paymentTermsDays),
    subtotal_excl_tax: Math.round(subtotal * 100) / 100,
    tax_rate: taxRate,
    tax_amount: Math.round(taxAmount * 100) / 100,
    total_incl_tax: Math.round(total * 100) / 100,
    amount_paid: 0,
    status: 'unpaid',
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(insert)
    .select('id, invoice_number')
    .single()

  if (error || !invoice) return { data: null, error: error?.message ?? 'Insert failed' }

  const links = shipmentIds.map((sid) => ({ invoice_id: invoice.id, shipment_id: sid }))
  const { error: linkError } = await supabase.from('invoice_shipments').insert(links)
  if (linkError) {
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { data: null, error: linkError.message }
  }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  return { data: { id: invoice.id, invoiceNumber: invoice.invoice_number }, error: null }
}

const RecordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'check']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export async function recordPayment(
  invoiceId: string,
  formData: z.infer<typeof RecordPaymentSchema>,
): Promise<ActionResult<null>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }

  const parsed = RecordPaymentSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }
  const { amount, paymentDate, paymentMethod, reference, notes } = parsed.data

  const supabase = await createClient()

  const { data: invoiceRaw } = await supabase
    .from('invoices')
    .select('total_incl_tax, amount_paid')
    .eq('id', invoiceId)
    .eq('company_id', user.companyId)
    .single()

  const invoice = invoiceRaw as { total_incl_tax: number; amount_paid: number } | null
  if (!invoice) return { data: null, error: 'Invoice not found' }

  const newAmountPaid = Number(invoice.amount_paid ?? 0) + amount
  const balance = Number(invoice.total_incl_tax) - newAmountPaid
  const newStatus = balance <= 0 ? 'paid' : 'partially_paid'

  const insert: TablesInsert<'invoice_payments'> = {
    invoice_id: invoiceId,
    company_id: user.companyId,
    amount,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    reference: reference ?? null,
    notes: notes ?? null,
  }

  const [{ error: paymentError }, { error: invoiceError }] = await Promise.all([
    supabase.from('invoice_payments').insert(insert),
    supabase
      .from('invoices')
      .update({
        amount_paid: Math.round(newAmountPaid * 100) / 100,
        status: newStatus,
      })
      .eq('id', invoiceId)
      .eq('company_id', user.companyId),
  ])

  if (paymentError) return { data: null, error: paymentError.message }
  if (invoiceError) return { data: null, error: invoiceError.message }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  revalidatePath(`/[locale]/(dashboard)/invoices/${invoiceId}`, 'page')
  return { data: null, error: null }
}
