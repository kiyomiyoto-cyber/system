import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Truck } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { listSuppliers, listSupplierInvoices } from '@/actions/suppliers'
import { PageHeader } from '@/components/shared/page-header'
import { SuppliersView } from './suppliers-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('suppliers'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const [suppliersRes, invoicesRes] = await Promise.all([
    listSuppliers(),
    listSupplierInvoices({ limit: 200 }),
  ])

  const suppliers = suppliersRes.data ?? []
  const invoices = invoicesRes.data ?? []
  const totalOutstanding = invoices.reduce(
    (s, i) => s + (i.status === 'cancelled' ? 0 : i.balanceDue),
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <Truck className="h-3.5 w-3.5" />
            {t('page.outstanding', {
              count: invoices.filter((i) => i.balanceDue > 0).length,
              total: new Intl.NumberFormat('fr-MA', {
                style: 'currency',
                currency: 'MAD',
                maximumFractionDigits: 0,
              }).format(totalOutstanding),
            })}
          </span>
        }
      />
      <SuppliersView suppliers={suppliers} invoices={invoices} locale={locale} />
    </div>
  )
}
