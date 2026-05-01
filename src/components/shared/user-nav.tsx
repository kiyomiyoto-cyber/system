'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calculator,
  ChevronUp,
  Eye,
  LogOut,
  Package,
  Settings,
  Truck,
  UserCog,
} from 'lucide-react'
import { signOut } from '@/actions/auth'
import { setViewAsRole, type ViewAsRole } from '@/actions/view-as'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/types/app.types'

interface UserNavProps {
  user: AuthUser
}

const ease = [0.22, 1, 0.36, 1] as const

export function UserNav({ user }: UserNavProps) {
  const t = useTranslations('nav')
  const tRoles = useTranslations('settings.role')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement | null>(null)

  function handleViewAs(role: ViewAsRole) {
    setOpen(false)
    startTransition(() => setViewAsRole(role, locale))
  }

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isAdmin = user.role === 'super_admin' || user.role === 'company_admin'

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors focus-ring',
          open ? 'bg-accent' : 'hover:bg-accent',
        )}
      >
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
          <span className="truncate text-sm font-medium leading-tight text-foreground">
            {user.fullName}
          </span>
          <span className="truncate text-xs leading-tight text-muted-foreground">
            {tRoles(user.role)}
          </span>
        </div>
        <ChevronUp
          className={cn(
            'ms-auto hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:block',
            open ? '' : 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease }}
            className="absolute bottom-full start-0 z-50 mb-2 w-72 origin-bottom-start overflow-hidden rounded-2xl border bg-popover shadow-soft-lg ring-1 ring-black/5"
          >
            {/* Profile header */}
            <div className="border-b bg-gradient-to-br from-primary/5 to-transparent px-4 py-4">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-primary/20">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {user.fullName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </div>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <UserCog className="h-2.5 w-2.5" />
                    {tRoles(user.role)}
                  </span>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="p-1.5">
              <a
                href={`/${locale}/settings`}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-ring"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                {t('settings')}
              </a>
            </div>

            {/* Admin: View as ... */}
            {isAdmin && (
              <>
                <div className="border-t" />
                <div className="px-3 pb-1.5 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('viewAs')}
                  </p>
                </div>
                <div className="px-1.5 pb-1.5">
                  <button
                    type="button"
                    onClick={() => handleViewAs('dispatcher')}
                    disabled={pending}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-ring disabled:opacity-50"
                    role="menuitem"
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-start">{t('viewAsDispatcher')}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {tRoles('dispatcher')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewAs('comptable')}
                    disabled={pending}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-ring disabled:opacity-50"
                    role="menuitem"
                  >
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-start">{t('viewAsComptable')}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {tRoles('comptable')}
                    </span>
                  </button>
                  <a
                    href={`/${locale}/my-shipments`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-ring"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{t('viewAsDriver')}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {tRoles('driver')}
                    </span>
                  </a>
                  <a
                    href={`/${locale}/portal/shipments`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-ring"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{t('viewAsClient')}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {tRoles('client')}
                    </span>
                  </a>
                </div>
              </>
            )}

            {/* Sign out */}
            <div className="border-t p-1.5">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-ring"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                {t('logout')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
