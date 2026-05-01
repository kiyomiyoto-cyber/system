'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher'] as const

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}
type AuthCheck = AuthOk | { ok: false; error: string }

async function ensureBackOffice(): Promise<AuthCheck> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

// ============================================================
// Override the JIT deadline of a single shipment.
//
// Most of the time the deadline equals delivery_scheduled_at (set
// automatically by trigger snapshot_jit_policy_on_shipment_insert).
// This action exists for the edge cases — TESCA negotiated a 30-min
// earlier cutoff for a specific dock, etc.
// ============================================================
const overrideSchema = z.object({
  shipmentId: z.string().uuid('Identifiant invalide'),
  deadlineAt: z
    .string()
    .datetime({ offset: true, message: 'Date invalide' })
    .nullable(),
  toleranceMinutes: z.coerce.number().int().min(0).max(720).optional(),
  penaltyPerHourMad: z.coerce.number().nonnegative().max(1_000_000).optional(),
})

export type JitOverrideInput = z.input<typeof overrideSchema>

export async function overrideShipmentJit(
  rawInput: JitOverrideInput,
): Promise<ActionResult<{ shipmentId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!WRITE_ROLES.includes(auth.user.role as (typeof WRITE_ROLES)[number])) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = overrideSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: shipment } = await supabase
    .from('shipments')
    .select('id, status, is_jit')
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!shipment) return { data: null, error: 'Expédition introuvable.' }
  if (shipment.status === 'delivered' || shipment.status === 'cancelled') {
    return { data: null, error: 'Expédition verrouillée — édition impossible.' }
  }
  if (!shipment.is_jit) {
    return { data: null, error: 'Cette expédition n\'est pas JIT.' }
  }

  const patch: Record<string, unknown> = {}
  patch.delivery_deadline_at = input.deadlineAt
  if (typeof input.toleranceMinutes === 'number') {
    patch.late_tolerance_minutes = input.toleranceMinutes
  }
  if (typeof input.penaltyPerHourMad === 'number') {
    patch.late_penalty_per_hour_mad = input.penaltyPerHourMad
  }

  const { error } = await supabase
    .from('shipments')
    .update(patch)
    .eq('id', input.shipmentId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('jit.override_failed', {
      action: 'overrideShipmentJit',
      shipmentId: input.shipmentId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/jit', 'page')
  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${input.shipmentId}`, 'page')
  return { data: { shipmentId: input.shipmentId }, error: null }
}

// ============================================================
// Update a client's JIT policy. Future shipments inherit the new
// values; existing rows keep their snapshot.
// ============================================================
const policySchema = z.object({
  clientId: z.string().uuid('Identifiant invalide'),
  deliveryWindowStrict: z.boolean(),
  latePenaltyPerHourMad: z.coerce.number().nonnegative().max(1_000_000),
  lateToleranceMinutes: z.coerce.number().int().min(0).max(720),
})

export type JitPolicyInput = z.input<typeof policySchema>

export async function setClientJitPolicy(
  rawInput: JitPolicyInput,
): Promise<ActionResult<{ clientId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!WRITE_ROLES.includes(auth.user.role as (typeof WRITE_ROLES)[number])) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = policySchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, delivery_window_strict, late_penalty_per_hour_mad, late_tolerance_minutes')
    .eq('id', input.clientId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { data: null, error: 'Client introuvable.' }

  const { error } = await supabase
    .from('clients')
    .update({
      delivery_window_strict: input.deliveryWindowStrict,
      late_penalty_per_hour_mad: input.latePenaltyPerHourMad,
      late_tolerance_minutes: input.lateToleranceMinutes,
    })
    .eq('id', input.clientId)
    .eq('company_id', auth.companyId)

  if (error) {
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  type ClientPolicySnapshot = {
    id: string
    business_name: string
    delivery_window_strict: boolean
    late_penalty_per_hour_mad: number
    late_tolerance_minutes: number
  }
  const before = client as unknown as ClientPolicySnapshot
  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'client_jit_policy',
    entityId: input.clientId,
    action: 'update',
    beforeState: {
      business_name: before.business_name,
      delivery_window_strict: before.delivery_window_strict,
      late_penalty_per_hour_mad: before.late_penalty_per_hour_mad,
      late_tolerance_minutes: before.late_tolerance_minutes,
    },
    afterState: {
      business_name: before.business_name,
      delivery_window_strict: input.deliveryWindowStrict,
      late_penalty_per_hour_mad: input.latePenaltyPerHourMad,
      late_tolerance_minutes: input.lateToleranceMinutes,
    },
    actor: { userId: auth.user.id, role: auth.user.role, name: auth.user.fullName },
  })

  revalidatePath('/[locale]/(dashboard)/jit', 'page')
  revalidatePath('/[locale]/(dashboard)/clients', 'page')
  return { data: { clientId: input.clientId }, error: null }
}
