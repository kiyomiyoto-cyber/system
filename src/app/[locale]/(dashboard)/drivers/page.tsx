import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Truck, Star, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'

export default async function DriversPage() {
  const [t, tCommon, locale, user, supabase] = await Promise.all([
    getTranslations('drivers'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, full_name, phone, email, license_number, license_expiry, is_available, total_deliveries, on_time_delivery_rate, average_rating, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  const today = new Date()
  const isLicenseExpiringSoon = (expiry: string | null) => {
    if (!expiry) return false
    const days = (new Date(expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return days < 60
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        action={
          <Link
            href={`/${locale}/drivers/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newDriver')}
          </Link>
        }
      />

      {drivers && drivers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((d) => (
            <Link
              key={d.id}
              href={`/${locale}/drivers/${d.id}`}
              className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {d.full_name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{d.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{d.phone}</p>
                  </div>
                </div>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.is_available ? 'bg-green-500' : 'bg-gray-300'}`} title={d.is_available ? t('available') : t('unavailable')} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('deliveries')}</p>
                  <p className="text-sm font-bold text-foreground">{d.total_deliveries ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('onTime')}</p>
                  <p className="text-sm font-bold text-foreground">{d.on_time_delivery_rate?.toFixed(0) ?? 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('rating')}</p>
                  <p className="flex items-center gap-1 text-sm font-bold text-foreground">
                    {d.average_rating ? d.average_rating.toFixed(1) : '—'}
                    {d.average_rating && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                  </p>
                </div>
              </div>

              {isLicenseExpiringSoon(d.license_expiry) && (
                <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('licenseExpiringSoon')}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Truck className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{t('noDrivers')}</p>
          <Link
            href={`/${locale}/drivers/new`}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newDriver')}
          </Link>
        </div>
      )}
    </div>
  )
}
