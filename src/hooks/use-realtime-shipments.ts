'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeShipments(companyId: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`shipments:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shipments'] })
          queryClient.invalidateQueries({ queryKey: ['v_shipment_kpis'] })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId, queryClient])
}
