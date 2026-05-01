import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { AdminWorkSessions } from '@/components/work-sessions/admin-work-sessions'
import { PresenceLast24h } from '@/components/work-sessions/presence-last-24h'

export default async function PresencePage({
  params,
}: {
  params: { locale: string }
}) {
  const { locale } = params
  const user = await getAuthenticatedUser()

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const t = await getTranslations('workSessions.page')

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <PresenceLast24h companyId={user.companyId} />
      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">{t('historyTitle')}</h2>
        <AdminWorkSessions companyId={user.companyId} />
      </div>
    </div>
  )
}
