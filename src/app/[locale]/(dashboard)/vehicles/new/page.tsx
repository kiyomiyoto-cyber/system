import { getTranslations } from 'next-intl/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { VehicleForm } from '@/components/forms/vehicle-form'

export default async function NewVehiclePage() {
  const [t, user] = await Promise.all([getTranslations('vehicles'), getAuthenticatedUser()])
  if (!user?.companyId) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('newVehicle')} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <VehicleForm companyId={user.companyId} />
      </div>
    </div>
  )
}
