import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import type { AccountantDeliveryMethod } from '@/types/database.types'
import { AccountantForm } from './accountant-form'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface AccountantRow {
  accountant_name: string
  cabinet_name: string | null
  email: string | null
  phone: string | null
  whatsapp_phone: string | null
  preferred_delivery_method: AccountantDeliveryMethod
  billing_terms: string | null
  notes: string | null
}

export default async function AccountantSettingsPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('accounting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('accountant_profiles')
    .select('accountant_name, cabinet_name, email, phone, whatsapp_phone, preferred_delivery_method, billing_terms, notes')
    .eq('company_id', user.companyId)
    .maybeSingle()

  const profile = data as unknown as AccountantRow | null

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/comptabilite`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('tva.backToAccounting')}
      </Link>

      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      <AccountantForm initialProfile={profile} />
    </div>
  )
}
