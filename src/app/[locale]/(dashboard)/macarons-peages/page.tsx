import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { CreditCard, AlertTriangle } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import {
  listVehiclePasses,
  listTollTransactions,
  listVignettes,
} from '@/actions/fleet-passes'
import { PageHeader } from '@/components/shared/page-header'
import { MacaronsPeagesView, type VehicleOption } from './macarons-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

export const dynamic = 'force-dynamic'

export default async function MacaronsPeagesPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('macaronsPeages'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [passesRes, tollsRes, vignettesRes, vehiclesRes] = await Promise.all([
    listVehiclePasses(),
    listTollTransactions({ limit: 100 }),
    listVignettes(),
    supabase
      .from('vehicles')
      .select('id, plate_number, is_active')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('plate_number', { ascending: true }),
  ])

  type VehicleRow = { id: string; plate_number: string; is_active: boolean }
  const vehicles: VehicleOption[] = (
    (vehiclesRes.data ?? []) as unknown as VehicleRow[]
  ).map((v) => ({ id: v.id, plate: v.plate_number, isActive: v.is_active }))

  const passes = passesRes.data ?? []
  const tolls = tollsRes.data ?? []
  const vignettes = vignettesRes.data ?? []

  const lowBalanceCount = passes.filter((p) => p.isLowBalance).length
  const expiringSoon = vignettes.filter((v) => v.daysUntilExpiry >= 0 && v.daysUntilExpiry <= 30).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <div className="flex items-center gap-2">
            {lowBalanceCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('page.lowBalance', { count: lowBalanceCount })}
              </span>
            )}
            {expiringSoon > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 ring-1 ring-rose-200">
                <CreditCard className="h-3.5 w-3.5" />
                {t('page.expiringSoon', { count: expiringSoon })}
              </span>
            )}
          </div>
        }
      />
      <MacaronsPeagesView
        passes={passes}
        tolls={tolls}
        vignettes={vignettes}
        vehicles={vehicles}
        locale={locale}
      />
    </div>
  )
}
