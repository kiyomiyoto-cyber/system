import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Package, MapPin, Clock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { formatDate } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function MyShipmentsPage() {
  const [t, tShipments, locale, user, supabase] = await Promise.all([
    getTranslations('driver'),
    getTranslations('shipments'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user) return null

  // Get driver record for this user
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', user.companyId)
    .single()

  const activeStatuses: ShipmentStatus[] = ['assigned', 'picked_up', 'in_transit']
  const doneStatuses: ShipmentStatus[] = ['delivered', 'failed']

  const [{ data: active }, { data: done }] = await Promise.all([
    driver
      ? supabase
          .from('shipments')
          .select('id, reference, status, pickup_city, pickup_address, delivery_city, delivery_address, delivery_scheduled_at, created_at')
          .eq('driver_id', driver.id)
          .eq('company_id', user.companyId)
          .in('status', activeStatuses)
          .is('deleted_at', null)
          .order('delivery_scheduled_at', { ascending: true })
      : { data: [] },
    driver
      ? supabase
          .from('shipments')
          .select('id, reference, status, pickup_city, delivery_city, delivery_scheduled_at, created_at')
          .eq('driver_id', driver.id)
          .eq('company_id', user.companyId)
          .in('status', doneStatuses)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] },
  ])

  return (
    <div className="space-y-6 p-4">
      {/* Active shipments */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('activeShipments')}</h2>
        {active && active.length > 0 ? (
          <ul className="space-y-3">
            {active.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/delivery/${s.id}`}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors active:bg-muted"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{s.reference}</span>
                      <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.pickup_city} → {s.delivery_city}</span>
                    </div>
                    {s.delivery_scheduled_at && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDate(s.delivery_scheduled_at)}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-12 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('noActiveShipments')}</p>
          </div>
        )}
      </section>

      {/* Recent completed */}
      {done && done.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">{t('recentDeliveries')}</h2>
          <ul className="space-y-2">
            {done.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/delivery/${s.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors active:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{s.reference}</span>
                      <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.pickup_city} → {s.delivery_city}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
