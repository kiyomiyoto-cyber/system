'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { UserCheck, UserX } from 'lucide-react'
import { deactivateUser, reactivateUser } from '@/actions/users'
import { formatDate } from '@/lib/utils/formatters'
import type { UserRole } from '@/types/database.types'

interface UserRow {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  company_admin: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-cyan-100 text-cyan-700',
  comptable: 'bg-emerald-100 text-emerald-700',
  driver: 'bg-amber-100 text-amber-700',
  client: 'bg-gray-100 text-gray-700',
}

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle(u: UserRow) {
    if (u.id === currentUserId) {
      toast.error(t('cannotDeactivateSelf'))
      return
    }
    startTransition(async () => {
      const result = u.is_active ? await deactivateUser(u.id) : await reactivateUser(u.id)
      if (result.success) {
        toast.success(u.is_active ? t('userDeactivated') : t('userReactivated'))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('user')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('role')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('status')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('lastLogin')}</th>
            <th className="px-4 py-3 text-end font-medium text-muted-foreground">{tCommon('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                  {t(`role.${u.role}`)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.is_active ? 'text-green-700' : 'text-gray-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {u.is_active ? t('active') : t('inactive')}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {u.last_login_at ? formatDate(u.last_login_at) : '—'}
              </td>
              <td className="px-4 py-3 text-end">
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleToggle(u)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      u.is_active
                        ? 'border-destructive/30 text-destructive hover:bg-destructive/5'
                        : 'border-green-200 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {u.is_active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                    {u.is_active ? t('deactivate') : t('reactivate')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
