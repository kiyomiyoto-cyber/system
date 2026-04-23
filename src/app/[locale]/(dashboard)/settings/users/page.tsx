import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { UsersTable } from './users-table'
import { CreateUserDialog } from './create-user-dialog'
import type { UserRole } from '@/types/database.types'

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, user, supabase] = await Promise.all([
    getTranslations('settings'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active, last_login_at, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('users')}
        subtitle={t('usersDesc')}
        action={<CreateUserDialog />}
      />

      <div className="rounded-xl border bg-card shadow-sm">
        {users && users.length > 0 ? (
          <UsersTable users={users.map((u) => ({ ...u, role: u.role as UserRole }))} currentUserId={user.id} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t('noUsers')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
