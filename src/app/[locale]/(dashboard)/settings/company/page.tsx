import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { CompanyForm } from './company-form'

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, user, supabase] = await Promise.all([
    getTranslations('settings'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', user.companyId)
    .single()

  if (!company) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('company')} subtitle={t('companyDesc')} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <CompanyForm company={company} />
      </div>
    </div>
  )
}
