'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert, TablesUpdate, VehicleType } from '@/types/database.types'

const VehicleSchema = z.object({
  plateNumber: z.string().min(2).max(20),
  type: z.enum(['van', 'truck', 'motorcycle', 'car', 'semi_truck']),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
  color: z.string().optional(),
  capacityKg: z.coerce.number().min(0).optional(),
  capacityM3: z.coerce.number().min(0).optional(),
  insuranceExpiry: z.string().optional(),
  technicalControlExpiry: z.string().optional(),
  driverId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().optional(),
})

export type VehicleFormData = z.infer<typeof VehicleSchema>

export async function createVehicle(formData: VehicleFormData): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = VehicleSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { plateNumber, type, brand, model, year, color, capacityKg, capacityM3, insuranceExpiry, technicalControlExpiry, driverId, notes } = parsed.data
  const supabase = await createClient()

  const insert: TablesInsert<'vehicles'> = {
    company_id: user.companyId,
    plate_number: plateNumber,
    type: type as VehicleType,
    brand: brand ?? null,
    model: model ?? null,
    year: year ?? null,
    color: color ?? null,
    capacity_kg: capacityKg ?? null,
    capacity_m3: capacityM3 ?? null,
    insurance_expiry: insuranceExpiry ?? null,
    technical_control_expiry: technicalControlExpiry ?? null,
    driver_id: driverId || null,
    notes: notes ?? null,
    is_active: true,
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/vehicles', 'page')
  return { success: true, data: { id: data.id } }
}

export async function updateVehicle(id: string, formData: VehicleFormData): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = VehicleSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { plateNumber, type, brand, model, year, color, capacityKg, capacityM3, insuranceExpiry, technicalControlExpiry, driverId, notes } = parsed.data
  const supabase = await createClient()

  const update: TablesUpdate<'vehicles'> = {
    plate_number: plateNumber,
    type: type as VehicleType,
    brand: brand ?? null,
    model: model ?? null,
    year: year ?? null,
    color: color ?? null,
    capacity_kg: capacityKg ?? null,
    capacity_m3: capacityM3 ?? null,
    insurance_expiry: insuranceExpiry ?? null,
    technical_control_expiry: technicalControlExpiry ?? null,
    driver_id: driverId || null,
    notes: notes ?? null,
  }

  const { error } = await supabase
    .from('vehicles')
    .update(update)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/vehicles', 'page')
  revalidatePath(`/[locale]/(dashboard)/vehicles/${id}`, 'page')
  return { success: true, data: undefined }
}

export async function deleteVehicle(id: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/vehicles', 'page')
  return { success: true, data: undefined }
}

export async function assignDriverToVehicle(vehicleId: string, driverId: string | null): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({ driver_id: driverId })
    .eq('id', vehicleId)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/vehicles', 'page')
  revalidatePath('/[locale]/(dashboard)/drivers', 'page')
  return { success: true, data: undefined }
}
