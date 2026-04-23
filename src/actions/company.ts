'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'

const CompanySchema = z.object({
  name: z.string().min(2),
  ice: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().min(2),
  country: z.string().default('MA'),
})

export type CompanyFormData = z.infer<typeof CompanySchema>

export async function updateCompany(formData: CompanyFormData): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = CompanySchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { name, ice, phone, email, address, city, country } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('companies')
    .update({
      name,
      ice: ice ?? null,
      phone: phone ?? null,
      email: email || null,
      address: address ?? null,
      city,
      country,
    })
    .eq('id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/settings/company', 'page')
  return { success: true, data: undefined }
}
