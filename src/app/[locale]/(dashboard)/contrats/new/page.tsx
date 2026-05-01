import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ContractForm } from '../contract-form'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher']

interface ClientOption {
  id: string
  business_name: string
}

export default async function NewContractPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('contracts'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('business_name', { ascending: true })

  const clients = ((data ?? []) as unknown as ClientOption[])

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/contrats`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('detail.backToList')}
      </Link>

      <PageHeader title={t('new.title')} description={t('new.subtitle')} />

      <ContractForm mode="create" clients={clients} />
    </div>
  )
}
