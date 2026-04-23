'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'

const DriverSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal('')),
  licenseNumber: z.string().min(3).max(30),
  licenseExpiry: z.string().optional(),
  cin: z.string().optional(),
  notes: z.string().optional(),
})

export type DriverFormData = z.infer<typeof DriverSchema>

export async function createDriver(formData: DriverFormData): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = DriverSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { fullName, phone, email, licenseNumber, licenseExpiry, cin, notes } = parsed.data
  const supabase = await createClient()

  const insert: TablesInsert<'drivers'> = {
    company_id: user.companyId,
    full_name: fullName,
    phone,
    email: email || null,
    license_number: licenseNumber,
    license_expiry: licenseExpiry ?? null,
    cin: cin ?? null,
    notes: notes ?? null,
    is_available: true,
  }

  const { data, error } = await supabase
    .from('drivers')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/drivers', 'page')
  return { success: true, data: { id: data.id } }
}

export async function updateDriver(id: string, formData: DriverFormData): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = DriverSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { fullName, phone, email, licenseNumber, licenseExpiry, cin, notes } = parsed.data
  const supabase = await createClient()

  const update: TablesUpdate<'drivers'> = {
    full_name: fullName,
    phone,
    email: email || null,
    license_number: licenseNumber,
    license_expiry: licenseExpiry ?? null,
    cin: cin ?? null,
    notes: notes ?? null,
  }

  const { error } = await supabase
    .from('drivers')
    .update(update)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/drivers', 'page')
  revalidatePath(`/[locale]/(dashboard)/drivers/${id}`, 'page')
  return { success: true, data: undefined }
}

export async function toggleDriverAvailability(id: string, isAvailable: boolean): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('drivers')
    .update({ is_available: isAvailable })
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/drivers', 'page')
  return { success: true, data: undefined }
}

export async function deleteDriver(id: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { count } = await supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', id)
    .eq('company_id', user.companyId)
    .in('status', ['assigned', 'picked_up', 'in_transit'])
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return { success: false, error: 'Cannot delete driver with active shipments' }
  }

  const { error } = await supabase
    .from('drivers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/drivers', 'page')
  return { success: true, data: undefined }
}
