'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type { RecurringScheduleVehicleType } from '@/types/database.types'

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
// Schema
// ============================================================

const scheduleSchema = z.object({
  clientId: z.string().uuid('Client invalide'),
  name: z.string().trim().min(1, 'Nom requis').max(120),
  isActive: z.boolean().optional().default(true),
  daysOfWeek: z.array(z.coerce.number().int().min(1).max(7)).min(1, 'Au moins un jour'),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Heure invalide'),
  deliveryOffsetMinutes: z.coerce.number().int().min(0).max(24 * 60).nullable().optional(),

  pickupStreet: z.string().trim().min(1, 'Adresse de chargement requise').max(255),
  pickupCity: z.string().trim().min(1, 'Ville de chargement requise').max(80),
  pickupPostalCode: z.string().trim().max(20).nullable().optional(),
  pickupLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  pickupLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  pickupContactName: z.string().trim().max(120).nullable().optional(),
  pickupContactPhone: z.string().trim().max(40).nullable().optional(),

  deliveryStreet: z.string().trim().min(1, 'Adresse de livraison requise').max(255),
  deliveryCity: z.string().trim().min(1, 'Ville de livraison requise').max(80),
  deliveryPostalCode: z.string().trim().max(20).nullable().optional(),
  deliveryLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  deliveryLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  deliveryContactName: z.string().trim().max(120).nullable().optional(),
  deliveryContactPhone: z.string().trim().max(40).nullable().optional(),

  defaultDriverId: z.string().uuid().nullable().optional(),
  defaultVehicleId: z.string().uuid().nullable().optional(),
  defaultVehicleType: z.enum(VEHICLE_TYPES).nullable().optional(),

  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début invalide'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de fin invalide').nullable().optional(),

  notes: z.string().trim().max(1000).nullable().optional(),
})

export type RecurringScheduleInput = z.input<typeof scheduleSchema>

// ============================================================
// CRUD
// ============================================================

export async function createRecurringSchedule(
  rawInput: RecurringScheduleInput,
): Promise<ActionResult<{ scheduleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  const parsed = scheduleSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', input.clientId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { data: null, error: 'Client introuvable.' }

  if (input.validTo && input.validTo < input.validFrom) {
    return { data: null, error: 'La date de fin doit être après la date de début.' }
  }

  const scheduleId = crypto.randomUUID()
  const { error } = await supabase.from('recurring_schedules').insert({
    id: scheduleId,
    company_id: auth.companyId,
    client_id: input.clientId,
    name: input.name,
    is_active: input.isActive ?? true,
    days_of_week: Array.from(new Set(input.daysOfWeek)).sort((a, b) => a - b),
    pickup_time: input.pickupTime,
    delivery_offset_minutes: input.deliveryOffsetMinutes ?? null,
    pickup_street: input.pickupStreet,
    pickup_city: input.pickupCity,
    pickup_postal_code: input.pickupPostalCode ?? null,
    pickup_lat: input.pickupLat ?? null,
    pickup_lng: input.pickupLng ?? null,
    pickup_contact_name: input.pickupContactName ?? null,
    pickup_contact_phone: input.pickupContactPhone ?? null,
    delivery_street: input.deliveryStreet,
    delivery_city: input.deliveryCity,
    delivery_postal_code: input.deliveryPostalCode ?? null,
    delivery_lat: input.deliveryLat ?? null,
    delivery_lng: input.deliveryLng ?? null,
    delivery_contact_name: input.deliveryContactName ?? null,
    delivery_contact_phone: input.deliveryContactPhone ?? null,
    default_driver_id: input.defaultDriverId ?? null,
    default_vehicle_id: input.defaultVehicleId ?? null,
    default_vehicle_type: (input.defaultVehicleType ?? null) as RecurringScheduleVehicleType | null,
    valid_from: input.validFrom,
    valid_to: input.validTo ?? null,
    notes: input.notes ?? null,
    created_by_user_id: auth.user.id,
  })

  if (error) {
    logger.error('recurring.create_failed', {
      action: 'createRecurringSchedule',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la création du programme.' }
  }

  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  return { data: { scheduleId }, error: null }
}

export async function updateRecurringSchedule(
  scheduleId: string,
  rawInput: RecurringScheduleInput,
): Promise<ActionResult<{ scheduleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(scheduleId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = scheduleSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('recurring_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Programme introuvable.' }

  const { error } = await supabase
    .from('recurring_schedules')
    .update({
      client_id: input.clientId,
      name: input.name,
      is_active: input.isActive ?? true,
      days_of_week: Array.from(new Set(input.daysOfWeek)).sort((a, b) => a - b),
      pickup_time: input.pickupTime,
      delivery_offset_minutes: input.deliveryOffsetMinutes ?? null,
      pickup_street: input.pickupStreet,
      pickup_city: input.pickupCity,
      pickup_postal_code: input.pickupPostalCode ?? null,
      pickup_lat: input.pickupLat ?? null,
      pickup_lng: input.pickupLng ?? null,
      pickup_contact_name: input.pickupContactName ?? null,
      pickup_contact_phone: input.pickupContactPhone ?? null,
      delivery_street: input.deliveryStreet,
      delivery_city: input.deliveryCity,
      delivery_postal_code: input.deliveryPostalCode ?? null,
      delivery_lat: input.deliveryLat ?? null,
      delivery_lng: input.deliveryLng ?? null,
      delivery_contact_name: input.deliveryContactName ?? null,
      delivery_contact_phone: input.deliveryContactPhone ?? null,
      default_driver_id: input.defaultDriverId ?? null,
      default_vehicle_id: input.defaultVehicleId ?? null,
      default_vehicle_type: (input.defaultVehicleType ?? null) as RecurringScheduleVehicleType | null,
      valid_from: input.validFrom,
      valid_to: input.validTo ?? null,
      notes: input.notes ?? null,
    })
    .eq('id', scheduleId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('recurring.update_failed', { scheduleId, error: error.message })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  return { data: { scheduleId }, error: null }
}

export async function toggleRecurringSchedule(
  scheduleId: string,
  isActive: boolean,
): Promise<ActionResult<{ scheduleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(scheduleId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_schedules')
    .update({ is_active: isActive })
    .eq('id', scheduleId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)

  if (error) return { data: null, error: 'Échec de la mise à jour.' }

  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  return { data: { scheduleId }, error: null }
}

export async function deleteRecurringSchedule(
  scheduleId: string,
): Promise<ActionResult<{ scheduleId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'company_admin') {
    return { data: null, error: 'Non autorisé.' }
  }

  if (!z.string().uuid().safeParse(scheduleId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_schedules')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', scheduleId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  return { data: { scheduleId }, error: null }
}

// ============================================================
// Generator
// ============================================================

/**
 * Returns ISO date strings for the upcoming Mon→Sun (next week if today is
 * Friday or later, otherwise the current ISO week).
 */
function nextWeekWindow(now: Date): { start: string; end: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay() // Mon=1..Sun=7
  // Days to add to reach next Monday: 8 - dow (so Mon→7, Sun→1)
  const start = new Date(d)
  start.setUTCDate(start.getUTCDate() + (8 - dow))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function runGenerationForNextWeek(): Promise<
  ActionResult<{ window: { start: string; end: string }; inserted: number }>
> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  const window = nextWeekWindow(new Date())
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('generate_recurring_shipments', {
    p_company_id: auth.companyId,
    p_window_start: window.start,
    p_window_end: window.end,
  })

  if (error) {
    logger.error('recurring.generate_failed', {
      action: 'runGenerationForNextWeek',
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la génération.' }
  }

  const inserted = typeof data === 'number' ? data : 0
  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  return { data: { window, inserted }, error: null }
}

export async function runGenerationForWindow(
  windowStart: string,
  windowEnd: string,
): Promise<ActionResult<{ inserted: number }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(windowStart) || !dateRegex.test(windowEnd) || windowEnd < windowStart) {
    return { data: null, error: 'Fenêtre invalide.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_recurring_shipments', {
    p_company_id: auth.companyId,
    p_window_start: windowStart,
    p_window_end: windowEnd,
  })

  if (error) return { data: null, error: 'Échec de la génération.' }

  revalidatePath('/[locale]/(dashboard)/recurring', 'page')
  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  return { data: { inserted: typeof data === 'number' ? data : 0 }, error: null }
}
