'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert } from '@/types/database.types'

export async function generateInvoiceForShipment(shipmentId: string): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: shipment } = await supabase
    .from('shipments')
    .select('*, client:clients(id, business_name, payment_terms_days, billing_mode)')
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .eq('status', 'delivered')
    .single()

  if (!shipment) return { success: false, error: 'Shipment not found or not delivered' }

  // Check no invoice exists yet
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.companyId)
    .contains('shipment_ids', [shipmentId])

  if ((count ?? 0) > 0) return { success: false, error: 'Invoice already exists for this shipment' }

  const { data: seqData } = await supabase.rpc('next_sequence_value', {
    p_company_id: user.companyId,
    p_type: 'invoice',
  })
  const year = new Date().getFullYear()
  const invoiceNumber = `FAC-${year}-${String(seqData ?? 1).padStart(4, '0')}`

  const client = shipment.client as { id: string; business_name: string; payment_terms_days: number } | null
  const paymentTermsDays = client?.payment_terms_days ?? 30
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + paymentTermsDays)

  const insert: TablesInsert<'invoices'> = {
    company_id: user.companyId,
    invoice_number: invoiceNumber,
    client_id: shipment.client_id,
    shipment_ids: [shipmentId],
    issue_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: shipment.price_excl_tax,
    vat_amount: shipment.vat_amount,
    total_amount: shipment.total_price,
    amount_paid: 0,
    status: 'unpaid',
    payment_terms_days: paymentTermsDays,
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(insert)
    .select('id, invoice_number')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  return { success: true, data: { id: invoice.id, invoiceNumber: invoice.invoice_number } }
}

export async function generateGroupedInvoice(
  clientId: string,
  shipmentIds: string[]
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }
  if (shipmentIds.length === 0) return { success: false, error: 'No shipments selected' }

  const supabase = await createClient()

  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, price_excl_tax, vat_amount, total_price')
    .eq('company_id', user.companyId)
    .eq('client_id', clientId)
    .eq('status', 'delivered')
    .in('id', shipmentIds)
    .is('deleted_at', null)

  if (!shipments || shipments.length === 0) {
    return { success: false, error: 'No eligible shipments found' }
  }

  const subtotal = shipments.reduce((s, sh) => s + (sh.price_excl_tax ?? 0), 0)
  const vatAmount = shipments.reduce((s, sh) => s + (sh.vat_amount ?? 0), 0)
  const totalAmount = shipments.reduce((s, sh) => s + (sh.total_price ?? 0), 0)

  const { data: clientData } = await supabase
    .from('clients')
    .select('payment_terms_days')
    .eq('id', clientId)
    .single()

  const paymentTermsDays = clientData?.payment_terms_days ?? 30
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + paymentTermsDays)

  const { data: seqData } = await supabase.rpc('next_sequence_value', {
    p_company_id: user.companyId,
    p_type: 'invoice',
  })
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(seqData ?? 1).padStart(4, '0')}`

  const insert: TablesInsert<'invoices'> = {
    company_id: user.companyId,
    invoice_number: invoiceNumber,
    client_id: clientId,
    shipment_ids: shipmentIds,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: Math.round(subtotal * 100) / 100,
    vat_amount: Math.round(vatAmount * 100) / 100,
    total_amount: Math.round(totalAmount * 100) / 100,
    amount_paid: 0,
    status: 'unpaid',
    payment_terms_days: paymentTermsDays,
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(insert)
    .select('id, invoice_number')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  return { success: true, data: { id: invoice.id, invoiceNumber: invoice.invoice_number } }
}

const RecordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'check', 'other']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export async function recordPayment(
  invoiceId: string,
  formData: z.infer<typeof RecordPaymentSchema>
): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = RecordPaymentSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { amount, paymentDate, paymentMethod, reference, notes } = parsed.data
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('id', invoiceId)
    .eq('company_id', user.companyId)
    .single()

  if (!invoice) return { success: false, error: 'Invoice not found' }

  const newAmountPaid = (invoice.amount_paid ?? 0) + amount
  const balance = invoice.total_amount - newAmountPaid
  const newStatus = balance <= 0 ? 'paid' : 'partially_paid'

  const insert: TablesInsert<'invoice_payments'> = {
    invoice_id: invoiceId,
    company_id: user.companyId,
    amount,
    payment_date: paymentDate,
    payment_method: paymentMethod as 'bank_transfer' | 'cash' | 'check' | 'other',
    reference: reference ?? null,
    notes: notes ?? null,
  }

  const [{ error: paymentError }, { error: invoiceError }] = await Promise.all([
    supabase.from('invoice_payments').insert(insert),
    supabase
      .from('invoices')
      .update({ amount_paid: Math.round(newAmountPaid * 100) / 100, status: newStatus })
      .eq('id', invoiceId)
      .eq('company_id', user.companyId),
  ])

  if (paymentError) return { success: false, error: paymentError.message }
  if (invoiceError) return { success: false, error: invoiceError.message }

  revalidatePath('/[locale]/(dashboard)/invoices', 'page')
  revalidatePath(`/[locale]/(dashboard)/invoices/${invoiceId}`, 'page')
  return { success: true, data: undefined }
}
