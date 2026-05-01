'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  checkIn,
  checkOut,
  getActiveSession,
  getOfficeGeofence,
  listWorkSessions,
  listWorkSessionsLast24h,
  type ActiveSession,
  type CheckInInput,
  type CheckOutInput,
  type EnrichedWorkSession,
  type OfficeGeofenceState,
} from '@/actions/work-sessions'

export const workSessionKeys = {
  all: ['work-sessions'] as const,
  active: (userId: string | null) =>
    [...workSessionKeys.all, 'active', userId ?? 'anon'] as const,
  geofence: () => [...workSessionKeys.all, 'geofence'] as const,
  adminList: (companyId: string | null) =>
    [...workSessionKeys.all, 'admin', companyId ?? 'all'] as const,
  last24h: (companyId: string | null) =>
    [...workSessionKeys.all, '24h', companyId ?? 'all'] as const,
}

function unwrap<T>(result: { data: T; error: null } | { data: null; error: string }): T {
  if (result.error) throw new Error(result.error)
  return result.data as T
}

// ============================================================
// Active session for the current user
// ============================================================
export function useActiveSession(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: workSessionKeys.active(userId),
    queryFn: async (): Promise<ActiveSession | null> => unwrap(await getActiveSession()),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  })
}

// ============================================================
// Office geofence (per-tenant)
// ============================================================
export function useOfficeGeofence(enabled = true) {
  return useQuery({
    queryKey: workSessionKeys.geofence(),
    queryFn: async (): Promise<OfficeGeofenceState> => unwrap(await getOfficeGeofence()),
    enabled,
    staleTime: 5 * 60_000,
  })
}

// ============================================================
// Mutations
// ============================================================
export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CheckInInput) => unwrap(await checkIn(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workSessionKeys.all })
    },
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CheckOutInput) => {
      const res = await checkOut(input)
      if (res.error) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workSessionKeys.all })
    },
  })
}

// ============================================================
// Admin views
// ============================================================
export function useAdminWorkSessions(companyId: string | null, enabled = true) {
  return useQuery({
    queryKey: workSessionKeys.adminList(companyId),
    queryFn: async (): Promise<EnrichedWorkSession[]> =>
      unwrap(await listWorkSessions({ limit: 500 })),
    enabled,
  })
}

export function useWorkSessionsLast24h(companyId: string | null, enabled = true) {
  return useQuery({
    queryKey: workSessionKeys.last24h(companyId),
    queryFn: async (): Promise<EnrichedWorkSession[]> =>
      unwrap(await listWorkSessionsLast24h()),
    enabled,
    refetchInterval: 60_000,
  })
}
