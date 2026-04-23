'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, User } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from '@/actions/auth'
import type { AuthUser } from '@/types/app.types'

interface UserNavProps {
  user: AuthUser
}

export function UserNav({ user }: UserNavProps) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
        )}
        <div className="hidden min-w-0 flex-col text-start lg:flex">
          <span className="truncate text-sm font-medium text-foreground leading-tight">
            {user.fullName}
          </span>
          <span className="truncate text-xs text-muted-foreground leading-tight">
            {user.email}
          </span>
        </div>
      </button>

      {/* Dropdown */}
      <div className="invisible absolute end-0 top-full z-50 mt-1 w-48 rounded-lg border bg-popover py-1 shadow-lg opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <a
          href={`/${locale}/settings`}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          {t('settings' as 'logout')}
        </a>
        <hr className="my-1 border-border" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  )
}
