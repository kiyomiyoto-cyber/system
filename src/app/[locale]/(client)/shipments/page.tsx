import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Package, MapPin, Clock, ChevronRight, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { formatDate } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function ClientShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const [t, tShipments, locale, user, supabase, sp] = await Promise.all([
    getTranslations('client'),
    getTranslations('shipments'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user) return null

  // Get client record for this user
  const { data: clientRecord } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('user_id', user.id)
    .eq('company_id', user.companyId)
    .single()

  let query = supabase
    .from('shipments')
    .select('id, reference, status, pickup_city, delivery_city, delivery_scheduled_at, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (clientRecord) {
    query = query.eq('client_id', clientRecord.id)
  }

  if (sp.status && sp.status !== 'all') {
    query = query.eq('status', sp.status as ShipmentStatus)
  }

  const { data: shipments } = await query.limit(50)

  const statusFilters: Array<{ value: string; label: string }> = [
    { value: 'all', label: tShipments('allStatuses') },
    { value: 'created', label: tShipments('status.created') },
    { value: 'assigned', label: tShipments('status.assigned') },
    { value: 'picked_up', label: tShipments('status.picked_up') },
    { value: 'in_transit', label: tShipments('status.in_transit') },
    { value: 'delivered', label: tShipments('status.delivered') },
  ]

  const activeFilter = sp.status ?? 'all'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('myShipments')}</h1>
        {clientRecord && (
          <p className="mt-0.5 text-sm text-muted-foreground">{clientRecord.business_name}</p>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statusFilters.map(({ value, label }) => (
          <Link
            key={value}
            href={value === 'all' ? `/${locale}/shipments` : `/${locale}/shipments?status=${value}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Shipment list */}
      {shipments && shipments.length > 0 ? (
        <ul className="space-y-3">
          {shipments.map((s) => (
            <li key={s.id}>
              <Link
                href={`/${locale}/shipments/${s.id}`}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
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
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{t('noShipments')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('noShipmentsHint')}</p>
        </div>
      )}
    </div>
  )
}
