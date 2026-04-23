import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Users, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { formatDate } from '@/lib/utils/formatters'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [t, tCommon, locale, user, supabase, sp] = await Promise.all([
    getTranslations('clients'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null

  let query = supabase
    .from('clients')
    .select('id, business_name, ice, phone, email, city, billing_mode, payment_terms_days, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('business_name', { ascending: true })

  if (sp.q) {
    query = query.or(`business_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,ice.ilike.%${sp.q}%`)
  }

  const { data: clients } = await query.limit(100)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        action={
          <Link
            href={`/${locale}/clients/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('newClient')}
          </Link>
        }
      />

      {/* Search */}
      <form className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={sp.q}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </form>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        {clients && clients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('businessName')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('phone')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('city')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('billingMode')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('paymentTerms')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{tCommon('createdAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/clients/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.business_name}
                      </Link>
                      {c.ice && <p className="mt-0.5 text-xs text-muted-foreground">ICE: {c.ice}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.city}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {c.billing_mode === 'per_shipment' ? t('perShipment') : t('monthlyGrouped')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.payment_terms_days}j</td>
                    <td className="px-4 py-3 text-end text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">{t('noClients')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('noClientsHint')}</p>
            <Link
              href={`/${locale}/clients/new`}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('newClient')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
