import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Edit, ArrowLeft, Car, User, Calendar, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { formatDate } from '@/lib/utils/formatters'

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const [t, tCommon, user, supabase] = await Promise.all([
    getTranslations('vehicles'),
    getTranslations('common'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(`*, driver:drivers(id, full_name, phone)`)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!vehicle) notFound()

  const driver = vehicle.driver as { id: string; full_name: string; phone: string } | null

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/vehicles`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <PageHeader
        title={vehicle.plate_number}
        action={
          <Link
            href={`/${locale}/vehicles/${id}/edit`}
            className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Edit className="h-4 w-4" />
            {tCommon('edit')}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">{t('details')}</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">{t('type')}</dt>
                <dd className="font-medium">{t(`types.${vehicle.type}`)}</dd>
              </div>
            </div>
            {(vehicle.brand || vehicle.model) && (
              <div className="flex items-start gap-3">
                <div className="h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('brand')} / {t('model')}</dt>
                  <dd className="font-medium">{vehicle.brand} {vehicle.model} {vehicle.year && `(${vehicle.year})`}</dd>
                </div>
              </div>
            )}
            {vehicle.capacity_kg && (
              <div className="flex items-start gap-3">
                <div className="h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('capacity')}</dt>
                  <dd className="font-medium">{vehicle.capacity_kg} kg{vehicle.capacity_m3 && ` · ${vehicle.capacity_m3} m³`}</dd>
                </div>
              </div>
            )}
          </dl>

          <div className="mt-5 border-t pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documents')}</h3>
            <dl className="space-y-2 text-sm">
              {vehicle.insurance_expiry && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> {t('insurance')}</dt>
                  <dd className="font-medium">{formatDate(vehicle.insurance_expiry)}</dd>
                </div>
              )}
              {vehicle.technical_control_expiry && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> {t('technicalControl')}</dt>
                  <dd className="font-medium">{formatDate(vehicle.technical_control_expiry)}</dd>
                </div>
              )}
            </dl>
          </div>

          {driver && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assignedDriver')}</h3>
              <Link
                href={`/${locale}/drivers/${driver.id}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <User className="h-4 w-4" />
                <span className="font-medium">{driver.full_name}</span>
                <span className="text-muted-foreground">· {driver.phone}</span>
              </Link>
            </div>
          )}

          {vehicle.notes && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('notes')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{vehicle.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
