'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'

const PricingDefaultsSchema = z.object({
  baseFee: z.coerce.number().min(0),
  pricePerKm: z.coerce.number().min(0),
  urgencySurchargePct: z.coerce.number().min(0).max(200),
  vatRatePct: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(180),
})

export type PricingDefaultsForm = z.infer<typeof PricingDefaultsSchema>

export async function updatePricingDefaults(
  formData: PricingDefaultsForm
): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = PricingDefaultsSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { baseFee, pricePerKm, urgencySurchargePct, vatRatePct, paymentTermsDays } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('pricing_defaults')
    .upsert(
      {
        company_id: user.companyId,
        base_fee: baseFee,
        price_per_km: pricePerKm,
        urgency_surcharge_pct: urgencySurchargePct,
        vat_rate_pct: vatRatePct,
        payment_terms_days: paymentTermsDays,
      },
      { onConflict: 'company_id' }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/settings/pricing', 'page')
  return { success: true, data: undefined }
}

const ContractSchema = z.object({
  clientId: z.string().uuid(),
  baseFee: z.coerce.number().min(0).optional(),
  pricePerKm: z.coerce.number().min(0).optional(),
  urgencySurchargePct: z.coerce.number().min(0).max(200).optional(),
  vatRatePct: z.coerce.number().min(0).max(100).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(180).optional(),
  effectiveFrom: z.string(),
  effectiveUntil: z.string().optional(),
  notes: z.string().optional(),
})

export async function createPricingContract(
  formData: z.infer<typeof ContractSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = ContractSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const { clientId, baseFee, pricePerKm, urgencySurchargePct, vatRatePct, paymentTermsDays, effectiveFrom, effectiveUntil, notes } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_pricing_contracts')
    .insert({
      company_id: user.companyId,
      client_id: clientId,
      base_fee: baseFee ?? null,
      price_per_km: pricePerKm ?? null,
      urgency_surcharge_pct: urgencySurchargePct ?? null,
      vat_rate_pct: vatRatePct ?? null,
      payment_terms_days: paymentTermsDays ?? null,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/[locale]/(dashboard)/clients/${clientId}`, 'page')
  return { success: true, data: { id: data.id } }
}
