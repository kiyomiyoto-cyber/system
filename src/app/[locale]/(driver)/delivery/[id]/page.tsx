import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, MapPin, Package, Phone, Calendar, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { DeliveryActions } from './delivery-actions'
import { formatDateTime, formatDistance } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function DeliveryPage({
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

  if (!user || user.role !== 'driver') return null

  const { data: shipment } = await supabase
    .from('shipments')
    .select(`*, client:clients(business_name, phone)`)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!shipment) notFound()

  // Verify driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!driver || shipment.driver_id !== driver.id) notFound()

  const client = shipment.client as { business_name: string; phone: string } | null

  const { data: documents } = await supabase
    .from('shipment_documents')
    .select('id, document_type, created_at')
    .eq('shipment_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4 p-4">
      <Link href={`/${locale}/my-shipments`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        {tCommon('back')}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-primary">{shipment.reference}</p>
          <h1 className="mt-1 text-lg font-bold text-foreground">{shipment.pickup_city} → {shipment.delivery_city}</h1>
        </div>
        <ShipmentStatusBadge status={shipment.status as ShipmentStatus} size="md" />
      </div>

      {/* Pickup card */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-green-600" /> {t('pickupLocation')}
        </h2>
        <p className="text-sm text-foreground">{shipment.pickup_address}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{shipment.pickup_city}</p>
        {shipment.pickup_lng && shipment.pickup_lat && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${shipment.pickup_lat},${shipment.pickup_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-primary"
          >
            {t('openInMaps')}
          </a>
        )}
      </div>

      {/* Delivery card */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-red-600" /> {t('deliveryLocation')}
        </h2>
        <p className="text-sm text-foreground">{shipment.delivery_address}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{shipment.delivery_city}</p>
        {shipment.delivery_lng && shipment.delivery_lat && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${shipment.delivery_lat},${shipment.delivery_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-primary"
          >
            {t('openInMaps')}
          </a>
        )}
      </div>

      {/* Client */}
      {client && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t('client')}</h2>
          <p className="text-sm font-medium">{client.business_name}</p>
          <a href={`tel:${client.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary">
            <Phone className="h-4 w-4" />
            {client.phone}
          </a>
        </div>
      )}

      {/* Cargo */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Package className="h-4 w-4" /> {t('cargoInfo')}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t('distance')}</dt>
            <dd className="font-medium">{formatDistance(shipment.distance_km ?? 0)}</dd>
          </div>
          {shipment.weight_kg && (
            <div>
              <dt className="text-xs text-muted-foreground">{t('weight')}</dt>
              <dd className="font-medium">{shipment.weight_kg} kg</dd>
            </div>
          )}
        </dl>
        {shipment.delivery_scheduled_at && (
          <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateTime(shipment.delivery_scheduled_at)}
          </div>
        )}
        {shipment.notes && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-muted-foreground mb-1">{t('notes')}</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{shipment.notes}</p>
          </div>
        )}
      </div>

      {/* Documents already uploaded */}
      {documents && documents.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="h-4 w-4" /> {t('uploadedDocuments')}</h2>
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{t(`documentType.${d.document_type}`)}</span>
                <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString('fr-MA')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <DeliveryActions shipmentId={id} status={shipment.status as ShipmentStatus} />
    </div>
  )
}
