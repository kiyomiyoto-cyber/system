import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, MapPin, User, Truck, Package, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { ShipmentTimeline } from '@/components/shared/shipment-timeline'
import { RouteMap } from '@/components/maps/route-map'
import { AssignDriverPanel } from './assign-driver-panel'
import { WhatsappSendButton } from '@/components/whatsapp/whatsapp-send-button'
import { formatMAD, formatDate, formatDateTime, formatDistance, formatWeight } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const [t, tCommon, user, supabase] = await Promise.all([
    getTranslations('shipments'),
    getTranslations('common'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: shipment } = await supabase
    .from('shipments')
    .select(`
      *,
      client:clients(id, business_name, phone, email),
      driver:drivers(id, full_name, phone)
    `)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!shipment) notFound()

  const client = shipment.client as { id: string; business_name: string; phone: string; email: string | null } | null
  const driver = shipment.driver as { id: string; full_name: string; phone: string } | null

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, full_name, is_available')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('full_name')

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/shipments`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{shipment.reference}</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {shipment.pickup_city} → {shipment.delivery_city}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {driver && (
            <WhatsappSendButton
              context={{ kind: 'shipment', shipmentId: shipment.id, audience: 'driver' }}
            />
          )}
          {client && (
            <WhatsappSendButton
              context={{ kind: 'shipment', shipmentId: shipment.id, audience: 'client' }}
            />
          )}
          <ShipmentStatusBadge status={shipment.status} size="lg" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Map */}
          {shipment.pickup_lng && shipment.delivery_lng && (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <RouteMap
                pickup={{ lng: shipment.pickup_lng, lat: shipment.pickup_lat ?? 0, address: shipment.pickup_address }}
                delivery={{ lng: shipment.delivery_lng, lat: shipment.delivery_lat ?? 0, address: shipment.delivery_address }}
                routeGeometry={shipment.route_geometry as GeoJSON.LineString | null}
                className="h-96 w-full"
              />
            </div>
          )}

          {/* Addresses */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-green-600" />
                {t('pickupLocation')}
              </h3>
              <p className="text-sm text-foreground">{shipment.pickup_address}</p>
              <p className="mt-1 text-xs text-muted-foreground">{shipment.pickup_city}</p>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-red-600" />
                {t('deliveryLocation')}
              </h3>
              <p className="text-sm text-foreground">{shipment.delivery_address}</p>
              <p className="mt-1 text-xs text-muted-foreground">{shipment.delivery_city}</p>
            </div>
          </div>

          {/* Cargo + pricing */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="h-4 w-4 text-primary" />
              {t('cargoAndPricing')}
            </h3>
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('distance')}</dt>
                <dd className="font-medium">{formatDistance(shipment.distance_km ?? 0)}</dd>
              </div>
              {shipment.weight_kg && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('weight')}</dt>
                  <dd className="font-medium">{formatWeight(shipment.weight_kg)}</dd>
                </div>
              )}
              {shipment.volume_m3 && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('volume')}</dt>
                  <dd className="font-medium">{shipment.volume_m3} m³</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 border-t pt-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t('subtotal')}</dt><dd>{formatMAD(shipment.price_excl_tax ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t('vat')}</dt><dd>{formatMAD(shipment.vat_amount ?? 0)}</dd></div>
                <div className="flex justify-between border-t pt-2 text-base"><dt className="font-semibold">{t('total')}</dt><dd className="font-bold text-primary">{formatMAD(shipment.total_price ?? 0)}</dd></div>
              </dl>
            </div>
          </div>

          {shipment.notes && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('notes')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{shipment.notes}</p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Timeline */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">{t('timeline')}</h3>
            <ShipmentTimeline
              status={shipment.status as ShipmentStatus}
              pickedUpAt={shipment.picked_up_at}
              deliveredAt={shipment.delivered_at}
              scheduledAt={shipment.delivery_scheduled_at}
              createdAt={shipment.created_at}
            />
          </div>

          {/* Client */}
          {client && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('client')}</h3>
              <Link href={`/${locale}/clients/${client.id}`} className="text-sm font-medium text-primary hover:underline">
                {client.business_name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{client.phone}</p>
            </div>
          )}

          {/* Driver assignment */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              {t('driver')}
            </h3>
            {driver ? (
              <div>
                <Link href={`/${locale}/drivers/${driver.id}`} className="text-sm font-medium text-primary hover:underline">
                  {driver.full_name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{driver.phone}</p>
              </div>
            ) : shipment.status === 'created' ? (
              <AssignDriverPanel
                shipmentId={id}
                drivers={(drivers ?? []) as Array<{ id: string; full_name: string; is_available: boolean }>}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">{t('notAssigned')}</p>
            )}
          </div>

          {shipment.delivery_scheduled_at && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('scheduledDelivery')}</h3>
              <p className="text-sm font-medium">{formatDateTime(shipment.delivery_scheduled_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
