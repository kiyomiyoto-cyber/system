import { getTranslations, getLocale } from 'next-intl/server'
import { TrendingUp, Package, DollarSign, Truck, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { formatMAD, formatDistance } from '@/lib/utils/formatters'

export default async function ReportsPage() {
  const [t, locale, user, supabase] = await Promise.all([
    getTranslations('reports'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const [{ data: kpis }, { data: drivers }, { data: topClients }] = await Promise.all([
    supabase.from('v_shipment_kpis').select('*').eq('company_id', user.companyId).single(),
    supabase
      .from('drivers')
      .select('id, full_name, total_deliveries, on_time_delivery_rate, average_rating, total_km_driven')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('total_deliveries', { ascending: false })
      .limit(10),
    supabase.rpc('get_top_clients_by_revenue', { p_company_id: user.companyId, p_limit: 5 }).then(
      (r) => r.error ? { data: [] } : r
    ),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('totalShipments')}
          value={kpis?.total_shipments ?? 0}
          icon={Package}
        />
        <KPICard
          title={t('totalRevenue')}
          value={formatMAD(kpis?.total_revenue ?? 0)}
          icon={DollarSign}
          iconColor="text-emerald-600"
        />
        <KPICard
          title={t('avgDistance')}
          value={formatDistance(kpis?.avg_distance_km ?? 0)}
          icon={TrendingUp}
          iconColor="text-blue-600"
        />
        <KPICard
          title={t('onTimeRate')}
          value={`${kpis?.on_time_rate_pct?.toFixed(1) ?? 0}%`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
      </div>

      {/* Driver leaderboard */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Truck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">{t('driverLeaderboard')}</h2>
        </div>
        {drivers && drivers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('driver')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('deliveries')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('onTimeRate')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('rating')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('totalKm')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drivers.map((d, idx) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{d.full_name}</td>
                  <td className="px-4 py-3 text-end font-bold">{d.total_deliveries ?? 0}</td>
                  <td className="px-4 py-3 text-end">{d.on_time_delivery_rate?.toFixed(1) ?? 0}%</td>
                  <td className="px-4 py-3 text-end">
                    <span className="inline-flex items-center gap-1">
                      {d.average_rating ? d.average_rating.toFixed(1) : '—'}
                      {d.average_rating && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">{formatDistance(d.total_km_driven ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('noData')}</p>
        )}
      </div>
    </div>
  )
}
