'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { UserNav } from '@/components/shared/user-nav'
import type { AuthUser } from '@/types/app.types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface SidebarToggleProps {
  navItems: NavItem[]
  settingsItem: NavItem
  user: AuthUser
}

export function SidebarToggle({ navItems, settingsItem, user }: SidebarToggleProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 start-0 z-50 w-72 flex flex-col border-e bg-sidebar shadow-xl animate-slide-in">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="font-bold text-sidebar-foreground">TMS Logistique</span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t p-3">
              <Link
                href={settingsItem.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <settingsItem.icon className="h-4 w-4 shrink-0" />
                {settingsItem.label}
              </Link>
              <div className="mt-3 px-1">
                <UserNav user={user} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
