'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type {
  ClientContractStatus,
  ClientContractBillingMode,
} from '@/types/database.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const VEHICLE_TYPES = ['motorcycle', 'van', 'truck', 'pickup'] as const

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
// Contract CRUD
// ============================================================

const contractSchema = z.object({
  clientId: z.string().uuid('Client invalide'),
  contractNumber: z.string().trim().max(80).nullable().optional(),
  signedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début invalide'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').nullable().optional(),
  paymentTermsDays: z.coerce.number().int().nonnegative(),
  billingMode: z.enum(['per_shipment', 'monthly_grouped']),
  autoRenewal: z.boolean().optional().default(false),
  status: z.enum(['active', 'expired', 'cancelled', 'draft']),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export type ContractInput = z.input<typeof contractSchema>

export async function createContract(
  rawInput: ContractInput,
): Promise<ActionResult<{ contractId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  const parsed = contractSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  // Verify client belongs to current tenant
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', input.clientId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { data: null, error: 'Client introuvable.' }

  // If activating a contract, expire any existing active contract for this client
  if (input.status === 'active') {
    await supabase
      .from('client_contracts')
      .update({ status: 'expired' as ClientContractStatus })
      .eq('client_id', input.clientId)
      .eq('company_id', auth.companyId)
      .eq('status', 'active')
      .is('deleted_at', null)
  }

  const contractId = crypto.randomUUID()
  const { error } = await supabase
    .from('client_contracts')
    .insert({
      id: contractId,
      company_id: auth.companyId,
      client_id: input.clientId,
      contract_number: input.contractNumber ?? null,
      signed_date: input.signedDate ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      payment_terms_days: input.paymentTermsDays,
      billing_mode: input.billingMode as ClientContractBillingMode,
      auto_renewal: input.autoRenewal ?? false,
      status: input.status,
      notes: input.notes ?? null,
      created_by_user_id: auth.user.id,
    })

  if (error) {
    logger.error('contract.create_failed', {
      action: 'createContract',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la création du contrat.' }
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { contractId }, error: null }
}

export async function updateContract(
  contractId: string,
  rawInput: ContractInput,
): Promise<ActionResult<{ contractId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(contractId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = contractSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from('client_contracts')
    .select('id, client_id, status')
    .eq('id', contractId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Contrat introuvable.' }

  // Activating? expire other actives
  if (input.status === 'active' && existing.status !== 'active') {
    await supabase
      .from('client_contracts')
      .update({ status: 'expired' as ClientContractStatus })
      .eq('client_id', input.clientId)
      .eq('company_id', auth.companyId)
      .eq('status', 'active')
      .neq('id', contractId)
      .is('deleted_at', null)
  }

  const { error } = await supabase
    .from('client_contracts')
    .update({
      contract_number: input.contractNumber ?? null,
      signed_date: input.signedDate ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      payment_terms_days: input.paymentTermsDays,
      billing_mode: input.billingMode as ClientContractBillingMode,
      auto_renewal: input.autoRenewal ?? false,
      status: input.status,
      notes: input.notes ?? null,
    })
    .eq('id', contractId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('contract.update_failed', {
      action: 'updateContract',
      contractId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  revalidatePath(`/[locale]/(dashboard)/contrats/${contractId}`, 'page')
  return { data: { contractId }, error: null }
}

export async function deleteContract(
  contractId: string,
): Promise<ActionResult<{ contractId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'company_admin') {
    return { data: null, error: 'Non autorisé.' }
  }

  if (!z.string().uuid().safeParse(contractId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contractId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { contractId }, error: null }
}

// ============================================================
// Pricing grid CRUD
// ============================================================

const pricingRuleSchema = z.object({
  routeLabel: z.string().trim().min(1, 'Libellé requis').max(120),
  pickupCity: z.string().trim().max(80).nullable().optional(),
  deliveryCity: z.string().trim().max(80).nullable().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).nullable().optional(),
  basePriceMad: z.coerce.number().nonnegative().max(1_000_000),
  surchargeNightPct: z.coerce.number().nonnegative().max(500).optional(),
  surchargeWeekendPct: z.coerce.number().nonnegative().max(500).optional(),
  surchargeUrgentPct: z.coerce.number().nonnegative().max(500).optional(),
  surchargeWaitingPerHourMad: z.coerce.number().nonnegative().max(10_000).optional(),
  customsZone: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
})

export type PricingRuleInput = z.input<typeof pricingRuleSchema>

export async function addPricingRule(
  contractId: string,
  rawInput: PricingRuleInput,
): Promise<ActionResult<{ ruleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(contractId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = pricingRuleSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  // Verify contract ownership
  const { data: contract } = await supabase
    .from('client_contracts')
    .select('id')
    .eq('id', contractId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!contract) return { data: null, error: 'Contrat introuvable.' }

  const ruleId = crypto.randomUUID()
  const { error } = await supabase
    .from('contract_pricing_grid')
    .insert({
      id: ruleId,
      contract_id: contractId,
      company_id: auth.companyId,
      route_label: input.routeLabel,
      pickup_city: input.pickupCity ?? null,
      delivery_city: input.deliveryCity ?? null,
      vehicle_type: input.vehicleType ?? null,
      base_price_mad: input.basePriceMad,
      surcharge_night_pct: input.surchargeNightPct ?? 30,
      surcharge_weekend_pct: input.surchargeWeekendPct ?? 50,
      surcharge_urgent_pct: input.surchargeUrgentPct ?? 25,
      surcharge_waiting_per_hour_mad: input.surchargeWaitingPerHourMad ?? 0,
      customs_zone: input.customsZone ?? false,
      notes: input.notes ?? null,
      sort_order: input.sortOrder ?? 0,
    })

  if (error) {
    logger.error('contract.rule.create_failed', { error: error.message })
    return { data: null, error: 'Échec de la création de la règle.' }
  }

  revalidatePath(`/[locale]/(dashboard)/contrats/${contractId}`, 'page')
  return { data: { ruleId }, error: null }
}

export async function updatePricingRule(
  ruleId: string,
  rawInput: PricingRuleInput,
): Promise<ActionResult<{ ruleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(ruleId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = pricingRuleSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('contract_pricing_grid')
    .select('id, contract_id')
    .eq('id', ruleId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Règle introuvable.' }

  const { error } = await supabase
    .from('contract_pricing_grid')
    .update({
      route_label: input.routeLabel,
      pickup_city: input.pickupCity ?? null,
      delivery_city: input.deliveryCity ?? null,
      vehicle_type: input.vehicleType ?? null,
      base_price_mad: input.basePriceMad,
      surcharge_night_pct: input.surchargeNightPct ?? 30,
      surcharge_weekend_pct: input.surchargeWeekendPct ?? 50,
      surcharge_urgent_pct: input.surchargeUrgentPct ?? 25,
      surcharge_waiting_per_hour_mad: input.surchargeWaitingPerHourMad ?? 0,
      customs_zone: input.customsZone ?? false,
      notes: input.notes ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .eq('id', ruleId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la mise à jour.' }

  revalidatePath(`/[locale]/(dashboard)/contrats/${existing.contract_id}`, 'page')
  return { data: { ruleId }, error: null }
}

export async function deletePricingRule(ruleId: string): Promise<ActionResult<{ ruleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(ruleId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('contract_pricing_grid')
    .select('contract_id')
    .eq('id', ruleId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Règle introuvable.' }

  const { error } = await supabase
    .from('contract_pricing_grid')
    .delete()
    .eq('id', ruleId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath(`/[locale]/(dashboard)/contrats/${existing.contract_id}`, 'page')
  return { data: { ruleId }, error: null }
}

// ============================================================
// findContractPrice — pricing engine integration helper
//
// Looks up the best matching pricing rule for a (client, route,
// vehicle type, date) tuple. Returns the rule + base price + surcharges,
// or null if no active contract / matching rule exists. The shipment
// pricing calculator will call this in a future ticket; for now it
// is exported for ad-hoc use.
// ============================================================
export interface ContractPriceMatch {
  contractId: string
  ruleId: string
  routeLabel: string
  basePriceMad: number
  surchargeNightPct: number
  surchargeWeekendPct: number
  surchargeUrgentPct: number
  surchargeWaitingPerHourMad: number
  customsZone: boolean
}

export async function findContractPrice(
  clientId: string,
  pickupCity: string,
  deliveryCity: string,
  vehicleType: 'motorcycle' | 'van' | 'truck' | 'pickup' | null,
  onDate: string,
): Promise<ActionResult<ContractPriceMatch | null>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()

  // Find active contract on the date
  const { data: contract } = await supabase
    .from('client_contracts')
    .select('id, end_date')
    .eq('client_id', clientId)
    .eq('company_id', auth.companyId)
    .eq('status', 'active')
    .lte('start_date', onDate)
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract) return { data: null, error: null }
  if (contract.end_date && contract.end_date < onDate) return { data: null, error: null }

  // Match a rule, ordered by specificity:
  //   1. exact pickup + delivery + vehicle_type
  //   2. exact pickup + delivery (vehicle_type NULL)
  //   3. catch-all (pickup_city NULL)
  const { data: rules } = await supabase
    .from('contract_pricing_grid')
    .select('id, route_label, pickup_city, delivery_city, vehicle_type, base_price_mad, surcharge_night_pct, surcharge_weekend_pct, surcharge_urgent_pct, surcharge_waiting_per_hour_mad, customs_zone')
    .eq('contract_id', contract.id)
    .eq('company_id', auth.companyId)
    .eq('is_active', true)

  type RuleRow = {
    id: string
    route_label: string
    pickup_city: string | null
    delivery_city: string | null
    vehicle_type: string | null
    base_price_mad: number
    surcharge_night_pct: number
    surcharge_weekend_pct: number
    surcharge_urgent_pct: number
    surcharge_waiting_per_hour_mad: number
    customs_zone: boolean
  }
  const list = (rules ?? []) as unknown as RuleRow[]
  if (list.length === 0) return { data: null, error: null }

  function scoreRule(rule: RuleRow): number {
    let score = 0
    if (rule.pickup_city && rule.pickup_city.toLowerCase() === pickupCity.toLowerCase()) score += 4
    else if (!rule.pickup_city) score += 1
    if (rule.delivery_city && rule.delivery_city.toLowerCase() === deliveryCity.toLowerCase()) score += 4
    else if (!rule.delivery_city) score += 1
    if (rule.vehicle_type && rule.vehicle_type === vehicleType) score += 2
    else if (!rule.vehicle_type) score += 1
    return score
  }

  // Filter rules that don't conflict (e.g. wrong vehicle_type), then pick highest score
  const candidates = list.filter((r) => {
    if (r.pickup_city && r.pickup_city.toLowerCase() !== pickupCity.toLowerCase()) return false
    if (r.delivery_city && r.delivery_city.toLowerCase() !== deliveryCity.toLowerCase()) return false
    if (r.vehicle_type && r.vehicle_type !== vehicleType) return false
    return true
  })
  if (candidates.length === 0) return { data: null, error: null }

  candidates.sort((a, b) => scoreRule(b) - scoreRule(a))
  const best = candidates[0]
  if (!best) return { data: null, error: null }

  return {
    data: {
      contractId: contract.id,
      ruleId: best.id,
      routeLabel: best.route_label,
      basePriceMad: Number(best.base_price_mad),
      surchargeNightPct: Number(best.surcharge_night_pct),
      surchargeWeekendPct: Number(best.surcharge_weekend_pct),
      surchargeUrgentPct: Number(best.surcharge_urgent_pct),
      surchargeWaitingPerHourMad: Number(best.surcharge_waiting_per_hour_mad),
      customsZone: best.customs_zone,
    },
    error: null,
  }
}
