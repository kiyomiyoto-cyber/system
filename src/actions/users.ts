'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'
import type { UserRole } from '@/types/database.types'

const CreateUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.enum(['company_admin', 'dispatcher', 'comptable', 'driver', 'client']),
  password: z.string().min(8).optional(),
})

export async function createUser(
  formData: z.infer<typeof CreateUserSchema>
): Promise<ActionResult<{ userId: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = CreateUserSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { email, fullName, phone, role, password } = parsed.data
  const serviceClient = createServiceClient()

  // Create auth user
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password: password ?? Math.random().toString(36).slice(-12) + 'A1!',
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create auth user' }
  }

  // Insert into public.users
  const { error: insertError } = await serviceClient.from('users').insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    phone: phone ?? null,
    role: role as UserRole,
    company_id: user.companyId,
    is_active: true,
  })

  if (insertError) {
    // Rollback auth user
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: insertError.message }
  }

  // If driver, create driver profile placeholder
  if (role === 'driver') {
    await serviceClient.from('drivers').insert({
      user_id: authData.user.id,
      company_id: user.companyId,
      full_name: fullName,
      phone: phone ?? '',
      is_available: true,
    })
  }

  // If client, the client record is created separately (see clients actions)

  revalidatePath('/[locale]/(dashboard)/settings/users', 'page')
  return { success: true, data: { userId: authData.user.id } }
}

export async function deactivateUser(userId: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }
  if (userId === user.id) {
    return { success: false, error: 'Cannot deactivate yourself' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', userId)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/settings/users', 'page')
  return { success: true, data: undefined }
}

export async function reactivateUser(userId: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', userId)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/settings/users', 'page')
  return { success: true, data: undefined }
}

export async function listCompanyUsers(): Promise<ActionResult<Array<{
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
}>>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active, last_login_at, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}
