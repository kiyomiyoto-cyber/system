import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ClientForm } from '@/components/forms/client-form'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [t, user, supabase] = await Promise.all([
    getTranslations('clients'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`${t('edit')}: ${client.business_name}`} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <ClientForm client={client} />
      </div>
    </div>
  )
}
