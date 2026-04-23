import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { PricingDefaultsForm } from './pricing-defaults-form'

export default async function PricingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, user, supabase] = await Promise.all([
    getTranslations('pricing'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const { data: defaults } = await supabase
    .from('pricing_defaults')
    .select('*')
    .eq('company_id', user.companyId)
    .single()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <PricingDefaultsForm defaults={defaults} />
      </div>
    </div>
  )
}
