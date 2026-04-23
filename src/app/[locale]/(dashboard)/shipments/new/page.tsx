import { getTranslations } from 'next-intl/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ShipmentForm } from '@/components/forms/shipment-form'

export default async function NewShipmentPage() {
  const [t, user] = await Promise.all([getTranslations('shipments'), getAuthenticatedUser()])
  if (!user?.companyId) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('newShipment')} />
      <ShipmentForm companyId={user.companyId} />
    </div>
  )
}
