import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Car, AlertTriangle, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { formatDate } from '@/lib/utils/formatters'

export default async function VehiclesPage() {
  const [t, tCommon, locale, user, supabase] = await Promise.all([
    getTranslations('vehicles'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select(`
      id, plate_number, type, brand, model, year, color, capacity_kg, capacity_m3,
      insurance_expiry, technical_control_expiry, is_active,
      driver:drivers(id, full_name)
    `)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('plate_number', { ascending: true })

  const today = new Date()
  const isExpiringSoon = (date: string | null) => {
    if (!date) return false
    const days = (new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return days < 60
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        action={
          <Link
            href={`/${locale}/vehicles/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newVehicle')}
          </Link>
        }
      />

      {vehicles && vehicles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const driver = v.driver as { id: string; full_name: string } | null
            const insuranceExp = isExpiringSoon(v.insurance_expiry)
            const techExp = isExpiringSoon(v.technical_control_expiry)

            return (
              <Link
                key={v.id}
                href={`/${locale}/vehicles/${v.id}`}
                className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-base font-bold text-foreground">{v.plate_number}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {v.brand && v.model ? `${v.brand} ${v.model}` : t(`types.${v.type}`)}
                      {v.year && <span className="text-xs"> · {v.year}</span>}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {t(`types.${v.type}`)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                  {v.capacity_kg && (
                    <div>
                      <p className="text-muted-foreground">{t('capacity')}</p>
                      <p className="font-medium">{v.capacity_kg} kg</p>
                    </div>
                  )}
                  {v.capacity_m3 && (
                    <div>
                      <p className="text-muted-foreground">{t('volume')}</p>
                      <p className="font-medium">{v.capacity_m3} m³</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t pt-3">
                  {driver ? (
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{driver.full_name}</span>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">{t('noDriverAssigned')}</p>
                  )}
                </div>

                {(insuranceExp || techExp) && (
                  <div className="mt-3 space-y-1.5">
                    {insuranceExp && (
                      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{t('insuranceExpiringSoon')}</span>
                      </div>
                    )}
                    {techExp && (
                      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{t('techControlExpiringSoon')}</span>
                      </div>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Car className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{t('noVehicles')}</p>
          <Link
            href={`/${locale}/vehicles/new`}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newVehicle')}
          </Link>
        </div>
      )}
    </div>
  )
}
