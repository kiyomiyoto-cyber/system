import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Edit, ArrowLeft, Phone, Mail, FileText, Truck, Star, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { AvailabilityToggle } from './availability-toggle'
import { formatDate, formatDistance } from '@/lib/utils/formatters'
import type { ShipmentStatus } from '@/types/database.types'

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const [t, tCommon, user, supabase] = await Promise.all([
    getTranslations('drivers'),
    getTranslations('common'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!driver) notFound()

  const [{ data: vehicle }, { data: shipments }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate_number, type, brand, model')
      .eq('driver_id', id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('shipments')
      .select('id, reference, status, pickup_city, delivery_city, distance_km, created_at')
      .eq('driver_id', id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/drivers`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <PageHeader
        title={driver.full_name}
        action={
          <Link
            href={`/${locale}/drivers/${id}/edit`}
            className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Edit className="h-4 w-4" />
            {tCommon('edit')}
          </Link>
        }
      />

      {/* Performance KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4" /> {t('totalDeliveries')}</div>
          <p className="mt-2 text-2xl font-bold text-foreground">{driver.total_deliveries ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4" /> {t('onTimeRate')}</div>
          <p className="mt-2 text-2xl font-bold text-green-600">{driver.on_time_delivery_rate?.toFixed(1) ?? '0.0'}%</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-4 w-4" /> {t('avgRating')}</div>
          <p className="mt-2 flex items-center gap-1 text-2xl font-bold text-foreground">
            {driver.average_rating ? driver.average_rating.toFixed(1) : '—'}
            {driver.average_rating && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4" /> {t('totalKm')}</div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatDistance(driver.total_km_driven ?? 0)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">{t('profile')}</h2>
            <AvailabilityToggle driverId={id} initialAvailable={driver.is_available ?? false} />
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">{t('phone')}</dt>
                <dd className="font-medium">{driver.phone}</dd>
              </div>
            </div>
            {driver.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('email')}</dt>
                  <dd className="font-medium break-all">{driver.email}</dd>
                </div>
              </div>
            )}
            {driver.license_number && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('licenseNumber')}</dt>
                  <dd className="font-medium">{driver.license_number}</dd>
                  {driver.license_expiry && <p className="text-xs text-muted-foreground mt-0.5">{t('expiresOn')} {formatDate(driver.license_expiry)}</p>}
                </div>
              </div>
            )}
          </dl>

          {vehicle && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assignedVehicle')}</h3>
              <Link
                href={`/${locale}/vehicles/${vehicle.id}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Truck className="h-4 w-4" />
                <span className="font-mono font-semibold">{vehicle.plate_number}</span>
                <span className="text-muted-foreground">{vehicle.brand} {vehicle.model}</span>
              </Link>
            </div>
          )}

          {driver.notes && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('notes')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{driver.notes}</p>
            </div>
          )}
        </div>

        {/* Recent shipments */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-foreground">{t('recentShipments')}</h2>
          </div>
          {shipments && shipments.length > 0 ? (
            <div className="divide-y">
              {shipments.map((s) => (
                <Link
                  key={s.id}
                  href={`/${locale}/shipments/${s.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span className="font-mono text-xs font-semibold text-primary">{s.reference}</span>
                  <span className="flex-1 truncate text-sm text-muted-foreground">{s.pickup_city} → {s.delivery_city}</span>
                  <span className="text-xs text-muted-foreground">{formatDistance(s.distance_km ?? 0)}</span>
                  <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('noShipmentsYet')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
