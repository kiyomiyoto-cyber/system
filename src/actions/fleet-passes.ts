'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import type { ActionResult } from '@/types/app.types'

const READ_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const

export type PassProvider = 'jawaz' | 'passplus' | 'autre'
export type VignetteKind = 'annual' | 'technical_inspection' | 'insurance' | 'tax_disc' | 'other'
export type TollKind = 'crossing' | 'top_up' | 'adjustment'

export interface VehiclePassRow {
  id: string
  vehicleId: string
  vehiclePlate: string | null
  provider: PassProvider
  tagNumber: string
  currentBalanceMad: number
  lowBalanceThresholdMad: number
  isActive: boolean
  isLowBalance: boolean
}

export interface TollTransactionRow {
  id: string
  vehiclePassId: string
  vehicleId: string
  vehiclePlate: string | null
  kind: TollKind
  occurredAt: string
  station: string | null
  amountMad: number
  reference: string | null
  shipmentId: string | null
}

export interface VignetteRow {
  id: string
  vehicleId: string
  vehiclePlate: string | null
  kind: VignetteKind
  reference: string | null
  amountMad: number | null
  issuedAt: string
  expiresAt: string
  daysUntilExpiry: number
}

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}

async function ensureWriter(): Promise<AuthOk | { ok: false; error: string }> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

async function ensureReader(): Promise<AuthOk | { ok: false; error: string }> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!READ_ROLES.includes(user.role as (typeof READ_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

// ============================================================
// Listing helpers
// ============================================================
export async function listVehiclePasses(): Promise<ActionResult<VehiclePassRow[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_passes')
    .select(
      'id, vehicle_id, provider, tag_number, current_balance_mad, low_balance_threshold_mad, is_active, vehicle:vehicles(plate_number)',
    )
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('tag_number', { ascending: true })

  if (error) return { data: null, error: error.message }
  type Row = {
    id: string
    vehicle_id: string
    provider: PassProvider
    tag_number: string
    current_balance_mad: number | string
    low_balance_threshold_mad: number | string
    is_active: boolean
    vehicle: { plate_number: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => {
      const balance = Number(r.current_balance_mad)
      const threshold = Number(r.low_balance_threshold_mad)
      return {
        id: r.id,
        vehicleId: r.vehicle_id,
        vehiclePlate: r.vehicle?.plate_number ?? null,
        provider: r.provider,
        tagNumber: r.tag_number,
        currentBalanceMad: balance,
        lowBalanceThresholdMad: threshold,
        isActive: r.is_active,
        isLowBalance: r.is_active && balance < threshold,
      }
    }),
    error: null,
  }
}

export async function listTollTransactions(opts?: {
  vehiclePassId?: string
  limit?: number
}): Promise<ActionResult<TollTransactionRow[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  let query = supabase
    .from('toll_transactions')
    .select(
      'id, vehicle_pass_id, vehicle_id, kind, occurred_at, station, amount_mad, reference, shipment_id, vehicle:vehicles(plate_number)',
    )
    .eq('company_id', auth.companyId)
    .order('occurred_at', { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.vehiclePassId) query = query.eq('vehicle_pass_id', opts.vehiclePassId)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    vehicle_pass_id: string
    vehicle_id: string
    kind: TollKind
    occurred_at: string
    station: string | null
    amount_mad: number | string
    reference: string | null
    shipment_id: string | null
    vehicle: { plate_number: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => ({
      id: r.id,
      vehiclePassId: r.vehicle_pass_id,
      vehicleId: r.vehicle_id,
      vehiclePlate: r.vehicle?.plate_number ?? null,
      kind: r.kind,
      occurredAt: r.occurred_at,
      station: r.station,
      amountMad: Number(r.amount_mad),
      reference: r.reference,
      shipmentId: r.shipment_id,
    })),
    error: null,
  }
}

export async function listVignettes(): Promise<ActionResult<VignetteRow[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vignettes')
    .select(
      'id, vehicle_id, kind, reference, amount_mad, issued_at, expires_at, vehicle:vehicles(plate_number)',
    )
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('expires_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  type Row = {
    id: string
    vehicle_id: string
    kind: VignetteKind
    reference: string | null
    amount_mad: number | string | null
    issued_at: string
    expires_at: string
    vehicle: { plate_number: string } | null
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rows = (data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      vehiclePlate: r.vehicle?.plate_number ?? null,
      kind: r.kind,
      reference: r.reference,
      amountMad: r.amount_mad == null ? null : Number(r.amount_mad),
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      daysUntilExpiry: Math.round(
        (new Date(r.expires_at).getTime() - today.getTime()) / 86400000,
      ),
    })),
    error: null,
  }
}

// ============================================================
// Mutations
// ============================================================
const upsertPassSchema = z.object({
  id: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  provider: z.enum(['jawaz', 'passplus', 'autre']),
  tagNumber: z.string().trim().min(1).max(64),
  lowBalanceThresholdMad: z.number().min(0).max(10000),
  isActive: z.boolean(),
})

export async function upsertVehiclePass(
  rawInput: z.input<typeof upsertPassSchema>,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = upsertPassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const i = parsed.data
  const supabase = await createClient()

  if (i.id) {
    const { error } = await supabase
      .from('vehicle_passes')
      .update({
        vehicle_id: i.vehicleId,
        provider: i.provider,
        tag_number: i.tagNumber,
        low_balance_threshold_mad: i.lowBalanceThresholdMad,
        is_active: i.isActive,
      })
      .eq('id', i.id)
      .eq('company_id', auth.companyId)
    if (error) return { data: null, error: error.code === '23505' ? 'Numéro de tag déjà existant.' : error.message }

    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'vehicle_pass',
      entityId: i.id,
      action: 'update',
      afterState: { ...i },
      actor: {
        userId: auth.user.id,
        role: auth.user.role,
        name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
      },
    })
    revalidatePath('/dashboard/macarons-peages')
    return { data: { id: i.id, created: false }, error: null }
  }

  const { data, error } = await supabase
    .from('vehicle_passes')
    .insert({
      company_id: auth.companyId,
      vehicle_id: i.vehicleId,
      provider: i.provider,
      tag_number: i.tagNumber,
      low_balance_threshold_mad: i.lowBalanceThresholdMad,
      is_active: i.isActive,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    return { data: null, error: error?.code === '23505' ? 'Numéro de tag déjà existant.' : (error?.message ?? 'Échec.') }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'vehicle_pass',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...i },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })
  revalidatePath('/dashboard/macarons-peages')
  return { data: { id: data.id, created: true }, error: null }
}

const recordTollSchema = z.object({
  vehiclePassId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  kind: z.enum(['crossing', 'top_up', 'adjustment']),
  occurredAt: z.string(),
  station: z.string().trim().max(120).nullable().optional(),
  amountMad: z.number(),
  reference: z.string().trim().max(120).nullable().optional(),
  shipmentId: z.string().uuid().nullable().optional(),
})

export async function recordTollTransaction(
  rawInput: z.input<typeof recordTollSchema>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = recordTollSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const i = parsed.data

  // Sign convention: crossing => negative; top_up => positive; adjustment => caller decides.
  let amount = i.amountMad
  if (i.kind === 'crossing' && amount > 0) amount = -amount
  if (i.kind === 'top_up' && amount < 0) amount = -amount

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('toll_transactions')
    .insert({
      company_id: auth.companyId,
      vehicle_pass_id: i.vehiclePassId,
      vehicle_id: i.vehicleId,
      kind: i.kind,
      occurred_at: i.occurredAt,
      station: i.station ?? null,
      amount_mad: amount,
      reference: i.reference ?? null,
      shipment_id: i.shipmentId ?? null,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Échec.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'toll_transaction',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...i, amount_mad: amount },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })
  revalidatePath('/dashboard/macarons-peages')
  return { data: { id: data.id }, error: null }
}

const upsertVignetteSchema = z.object({
  id: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  kind: z.enum(['annual', 'technical_inspection', 'insurance', 'tax_disc', 'other']),
  reference: z.string().trim().max(120).nullable().optional(),
  amountMad: z.number().nullable().optional(),
  issuedAt: z.string(),
  expiresAt: z.string(),
})

export async function upsertVignette(
  rawInput: z.input<typeof upsertVignetteSchema>,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = upsertVignetteSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const i = parsed.data
  const supabase = await createClient()

  if (i.id) {
    const { error } = await supabase
      .from('vignettes')
      .update({
        vehicle_id: i.vehicleId,
        kind: i.kind,
        reference: i.reference ?? null,
        amount_mad: i.amountMad ?? null,
        issued_at: i.issuedAt,
        expires_at: i.expiresAt,
      })
      .eq('id', i.id)
      .eq('company_id', auth.companyId)
    if (error) return { data: null, error: error.message }

    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'vignette',
      entityId: i.id,
      action: 'update',
      afterState: { ...i },
      actor: {
        userId: auth.user.id,
        role: auth.user.role,
        name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
      },
    })
    revalidatePath('/dashboard/macarons-peages')
    return { data: { id: i.id, created: false }, error: null }
  }

  const { data, error } = await supabase
    .from('vignettes')
    .insert({
      company_id: auth.companyId,
      vehicle_id: i.vehicleId,
      kind: i.kind,
      reference: i.reference ?? null,
      amount_mad: i.amountMad ?? null,
      issued_at: i.issuedAt,
      expires_at: i.expiresAt,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Échec.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'vignette',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...i },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })
  revalidatePath('/dashboard/macarons-peages')
  return { data: { id: data.id, created: true }, error: null }
}
