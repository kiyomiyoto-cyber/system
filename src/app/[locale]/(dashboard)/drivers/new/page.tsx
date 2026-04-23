import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { DriverForm } from '@/components/forms/driver-form'

export default async function NewDriverPage() {
  const t = await getTranslations('drivers')
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('newDriver')} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <DriverForm />
      </div>
    </div>
  )
}
