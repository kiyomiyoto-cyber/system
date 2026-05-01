'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { isInsideOffice, type OfficeGeofence } from '@/lib/geofence'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'

const TEAM_ROLES = ['dispatcher', 'driver', 'comptable'] as const
type TeamRole = (typeof TEAM_ROLES)[number]

export interface OfficeGeofenceResult extends OfficeGeofence {
  configured: true
}

export type OfficeGeofenceState =
  | OfficeGeofenceResult
  | { configured: false }

// ============================================================
// Geofence configuration (read by the gate)
// ============================================================
export async function getOfficeGeofence(): Promise<ActionResult<OfficeGeofenceState>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) {
    return { data: null, error: 'Non autorisé.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('office_lat, office_lng, office_radius_m, office_label, office_maps_url')
    .eq('id', user.companyId)
    .single()

  if (error) {
    logger.error('Failed to load office geofence', {
      action: 'getOfficeGeofence',
      userId: user.id,
      companyId: user.companyId,
      error: error.message,
    })
    return { data: null, error: error.message }
  }

  if (data.office_lat == null || data.office_lng == null) {
    return { data: { configured: false }, error: null }
  }

  return {
    data: {
      configured: true,
      lat: Number(data.office_lat),
      lng: Number(data.office_lng),
      radiusMeters: data.office_radius_m,
      label: data.office_label,
      mapsUrl: data.office_maps_url,
    },
    error: null,
  }
}

// ============================================================
// Active session for the current user
// ============================================================
export interface ActiveSession {
  id: string
  user_id: string
  role: string
  check_in_at: string
  check_out_at: string | null
}

export async function getActiveSession(): Promise<ActionResult<ActiveSession | null>> {
  const user = await getAuthenticatedUser()
  if (!user) return { data: null, error: 'Non autorisé.' }

  // Admins and clients are not gated by check-in.
  if (!TEAM_ROLES.includes(user.role as TeamRole)) {
    return { data: null, error: null }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_sessions')
    .select('id, user_id, role, check_in_at, check_out_at')
    .eq('user_id', user.id)
    .is('check_out_at', null)
    .order('check_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

// ============================================================
// Check-in
// ============================================================
const checkInSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100_000).nullable().optional(),
})

export type CheckInInput = z.input<typeof checkInSchema>

export async function checkIn(
  rawInput: CheckInInput,
): Promise<ActionResult<{ sessionId: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) {
    return { data: null, error: 'Non autorisé.' }
  }
  if (!TEAM_ROLES.includes(user.role as TeamRole)) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = checkInSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Position invalide.' }
  }
  const { lat, lng, accuracy } = parsed.data

  // Re-verify the geofence server-side (defense in depth).
  const geofence = await getOfficeGeofence()
  if (geofence.error || !geofence.data) {
    return { data: null, error: geofence.error ?? 'Géofence indisponible.' }
  }
  if (!geofence.data.configured) {
    return {
      data: null,
      error:
        'Le géofence du bureau n\'est pas configuré. Demandez à un administrateur de définir la position du bureau.',
    }
  }

  const { inside, distance } = isInsideOffice(
    { lat, lng, accuracy: accuracy ?? null },
    geofence.data,
  )
  if (!inside) {
    logger.warn('Check-in refused — outside geofence', {
      action: 'checkIn',
      userId: user.id,
      companyId: user.companyId,
      distance: Math.round(distance),
      radius: geofence.data.radiusMeters,
    })
    return {
      data: null,
      error: 'Vous devez être au bureau pour faire le check-in.',
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_sessions')
    .insert({
      company_id: user.companyId,
      user_id: user.id,
      role: user.role,
      check_in_lat: lat,
      check_in_lng: lng,
      check_in_accuracy: accuracy ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation → there is already an open session.
    if (error.code === '23505') {
      return { data: null, error: 'Une session est déjà ouverte.' }
    }
    logger.error('Check-in insert failed', {
      action: 'checkIn',
      userId: user.id,
      companyId: user.companyId,
      error: error.message,
    })
    return { data: null, error: error.message }
  }

  logger.info('Check-in recorded', {
    action: 'checkIn',
    userId: user.id,
    companyId: user.companyId,
  })

  return { data: { sessionId: data.id }, error: null }
}

// ============================================================
// Check-out
// ============================================================
const checkOutSchema = z.object({
  sessionId: z.string().uuid(),
  prodRating: z.coerce.number().int().min(1).max(5),
  motivRating: z.coerce.number().int().min(1).max(5),
  blockers: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  accuracy: z.coerce.number().min(0).max(100_000).nullable().optional(),
})

export type CheckOutInput = z.input<typeof checkOutSchema>

export async function checkOut(rawInput: CheckOutInput): Promise<ActionResult> {
  const user = await getAuthenticatedUser()
  if (!user) return { data: null, error: 'Non autorisé.' }

  const parsed = checkOutSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_sessions')
    .update({
      check_out_at: new Date().toISOString(),
      prod_rating: input.prodRating,
      motiv_rating: input.motivRating,
      blockers: input.blockers?.length ? input.blockers : null,
      notes: input.notes?.length ? input.notes : null,
      check_out_lat: input.lat ?? null,
      check_out_lng: input.lng ?? null,
      check_out_accuracy: input.accuracy ?? null,
    })
    .eq('id', input.sessionId)
    .eq('user_id', user.id)
    .is('check_out_at', null)

  if (error) {
    logger.error('Check-out failed', {
      action: 'checkOut',
      userId: user.id,
      companyId: user.companyId ?? undefined,
      error: error.message,
    })
    return { data: null, error: error.message }
  }

  logger.info('Check-out recorded', {
    action: 'checkOut',
    userId: user.id,
    companyId: user.companyId ?? undefined,
  })

  return { data: null, error: null }
}

// ============================================================
// Admin / supervision queries
// ============================================================
export interface EnrichedWorkSession {
  id: string
  user_id: string
  role: string
  check_in_at: string
  check_out_at: string | null
  prod_rating: number | null
  motiv_rating: number | null
  blockers: string | null
  notes: string | null
  user: {
    full_name: string
    email: string
    role: string
    avatar_url: string | null
  } | null
}

const ADMIN_ROLES = ['super_admin', 'company_admin'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

async function ensureAdmin(): Promise<
  | { ok: true; companyId: string | null; role: AdminRole; userId: string }
  | { ok: false; error: string }
> {
  const user = await getAuthenticatedUser()
  if (!user) return { ok: false, error: 'Non autorisé.' }
  if (!ADMIN_ROLES.includes(user.role as AdminRole)) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, companyId: user.companyId, role: user.role as AdminRole, userId: user.id }
}

export async function listWorkSessions(opts?: {
  limit?: number
}): Promise<ActionResult<EnrichedWorkSession[]>> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000)

  let query = supabase
    .from('work_sessions')
    .select(
      'id, user_id, role, check_in_at, check_out_at, prod_rating, motiv_rating, blockers, notes, user:users!work_sessions_user_id_fkey(full_name, email, role, avatar_url)',
    )
    .order('check_in_at', { ascending: false })
    .limit(limit)

  if (auth.role === 'company_admin' && auth.companyId) {
    query = query.eq('company_id', auth.companyId)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: (data ?? []) as unknown as EnrichedWorkSession[], error: null }
}

export async function listWorkSessionsLast24h(): Promise<
  ActionResult<EnrichedWorkSession[]>
> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('work_sessions')
    .select(
      'id, user_id, role, check_in_at, check_out_at, prod_rating, motiv_rating, blockers, notes, user:users!work_sessions_user_id_fkey(full_name, email, role, avatar_url)',
    )
    .gte('check_in_at', since)
    .order('check_in_at', { ascending: false })

  if (auth.role === 'company_admin' && auth.companyId) {
    query = query.eq('company_id', auth.companyId)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: (data ?? []) as unknown as EnrichedWorkSession[], error: null }
}
