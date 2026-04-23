'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert, TablesUpdate, BillingMode } from '@/types/database.types'

const ClientSchema = z.object({
  businessName: z.string().min(2).max(200),
  ice: z.string().optional(),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().min(2).max(100),
  billingMode: z.enum(['per_shipment', 'monthly_grouped']),
  paymentTermsDays: z.coerce.number().int().min(0).max(90),
  notes: z.string().optional(),
})

export type ClientFormData = z.infer<typeof ClientSchema>

export async function createClient_action(formData: ClientFormData): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = ClientSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { businessName, ice, phone, email, address, city, billingMode, paymentTermsDays, notes } = parsed.data
  const supabase = await createClient()

  const insert: TablesInsert<'clients'> = {
    company_id: user.companyId,
    business_name: businessName,
    ice: ice ?? null,
    phone,
    email: email || null,
    address: address ?? null,
    city,
    billing_mode: billingMode as BillingMode,
    payment_terms_days: paymentTermsDays,
    notes: notes ?? null,
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/clients', 'page')
  return { success: true, data: { id: data.id } }
}

export async function updateClient(id: string, formData: ClientFormData): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = ClientSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { businessName, ice, phone, email, address, city, billingMode, paymentTermsDays, notes } = parsed.data
  const supabase = await createClient()

  const update: TablesUpdate<'clients'> = {
    business_name: businessName,
    ice: ice ?? null,
    phone,
    email: email || null,
    address: address ?? null,
    city,
    billing_mode: billingMode as BillingMode,
    payment_terms_days: paymentTermsDays,
    notes: notes ?? null,
  }

  const { error } = await supabase
    .from('clients')
    .update(update)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/clients', 'page')
  revalidatePath(`/[locale]/(dashboard)/clients/${id}`, 'page')
  return { success: true, data: undefined }
}

export async function deleteClient(id: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Check for active shipments
  const { count } = await supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
    .eq('company_id', user.companyId)
    .in('status', ['created', 'assigned', 'picked_up', 'in_transit'])
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return { success: false, error: 'Cannot delete client with active shipments' }
  }

  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/clients', 'page')
  return { success: true, data: undefined }
}
