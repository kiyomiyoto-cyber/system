import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { VehicleForm } from '@/components/forms/vehicle-form'

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [t, user, supabase] = await Promise.all([
    getTranslations('vehicles'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!vehicle) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`${t('edit')}: ${vehicle.plate_number}`} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <VehicleForm vehicle={vehicle} companyId={user.companyId} />
      </div>
    </div>
  )
}
