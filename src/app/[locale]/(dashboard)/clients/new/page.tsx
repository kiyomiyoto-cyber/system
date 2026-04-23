import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ClientForm } from '@/components/forms/client-form'

export default async function NewClientPage() {
  const t = await getTranslations('clients')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('newClient')} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <ClientForm />
      </div>
    </div>
  )
}
