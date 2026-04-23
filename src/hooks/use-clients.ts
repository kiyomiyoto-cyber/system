'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (companyId: string, search?: string) => [...clientKeys.lists(), companyId, search ?? ''] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
}

export function useClients(companyId: string, search?: string) {
  return useQuery({
    queryKey: clientKeys.list(companyId, search),
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('clients')
        .select('id, business_name, ice, phone, email, city, billing_mode, payment_terms_days, created_at')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('business_name', { ascending: true })

      if (search && search.trim()) {
        query = query.or(`business_name.ilike.%${search}%,phone.ilike.%${search}%,ice.ilike.%${search}%`)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      return data ?? []
    },
    enabled: !!companyId,
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
      if (error) throw error
      return data as Tables<'clients'>
    },
    enabled: !!id,
  })
}
