import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Package, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

const STATUSES: ShipmentStatus[] = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled']

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; client?: string }>
}) {
  const [t, tCommon, locale, user, supabase, sp] = await Promise.all([
    getTranslations('shipments'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null

  let query = supabase
    .from('shipments')
    .select(`
      id, reference, status, pickup_city, delivery_city,
      delivery_scheduled_at, total_price, created_at,
      client:clients(business_name),
      driver:drivers(full_name)
    `)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (sp.status && sp.status !== 'all') query = query.eq('status', sp.status as ShipmentStatus)
  if (sp.client) query = query.eq('client_id', sp.client)
  if (sp.q) query = query.ilike('reference', `%${sp.q}%`)

  const { data: shipments } = await query.limit(100)

  const activeFilter = sp.status ?? 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        action={
          <Link
            href={`/${locale}/shipments/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newShipment')}
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={sp.q}
            placeholder={t('searchByReference')}
            className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={`/${locale}/shipments`}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          {t('allStatuses')}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/shipments?status=${s}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        {shipments && shipments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('reference')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('client')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('route')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('driver')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('scheduledDelivery')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('totalPrice')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('status.label')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shipments.map((s) => {
                  const client = s.client as { business_name: string } | null
                  const driver = s.driver as { full_name: string } | null
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/shipments/${s.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {s.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{client?.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.pickup_city} → {s.delivery_city}</td>
                      <td className="px-4 py-3 text-muted-foreground">{driver?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.delivery_scheduled_at ? formatDate(s.delivery_scheduled_at) : '—'}</td>
                      <td className="px-4 py-3 text-end font-medium">{formatMAD(s.total_price ?? 0)}</td>
                      <td className="px-4 py-3"><ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">{t('noShipments')}</p>
            <Link
              href={`/${locale}/shipments/new`}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('newShipment')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
