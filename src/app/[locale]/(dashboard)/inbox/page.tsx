import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Inbox } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { listInbox } from '@/actions/inbox'
import { PageHeader } from '@/components/shared/page-header'
import { InboxView } from './inbox-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('inbox'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const res = await listInbox({ limit: 200 })
  const items = res.data ?? []
  const unreadCount = items.filter((i) => !i.isRead).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
            <Inbox className="h-3.5 w-3.5" />
            {t('page.unreadBadge', { count: unreadCount })}
          </span>
        }
      />
      <InboxView items={items} locale={locale} loadError={res.error} />
    </div>
  )
}
