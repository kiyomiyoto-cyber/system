'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Menu,
  X,
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Car,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserNav } from '@/components/shared/user-nav'
import type { AuthUser } from '@/types/app.types'

export type NavIconKey =
  | 'dashboard'
  | 'shipments'
  | 'clients'
  | 'drivers'
  | 'vehicles'
  | 'invoices'
  | 'reports'
  | 'settings'

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  shipments: Package,
  clients: Users,
  drivers: Truck,
  vehicles: Car,
  invoices: FileText,
  reports: BarChart3,
  settings: Settings,
}

interface NavItem {
  href: string
  label: string
  iconKey: NavIconKey
}

interface SidebarToggleProps {
  navItems: NavItem[]
  settingsItem: NavItem
  user: AuthUser
}

const ease = [0.22, 1, 0.36, 1] as const

export function SidebarToggle({ navItems, settingsItem, user }: SidebarToggleProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const SettingsIcon = ICONS[settingsItem.iconKey]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-accent focus-ring"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease }}
              className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease }}
              className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e bg-sidebar shadow-soft-lg"
            >
              <div className="flex h-16 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
                    <Package className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-sidebar-foreground">TMS Logistique</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent focus-ring"
                  aria-label="Fermer le menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3">
                <ul className="space-y-0.5">
                  {navItems.map(({ href, label, iconKey }, idx) => {
                    const Icon = ICONS[iconKey]
                    const isActive =
                      pathname === href || pathname.startsWith(href + '/')
                    return (
                      <motion.li
                        key={href}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, ease, delay: 0.04 + idx * 0.03 }}
                      >
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-white text-primary shadow-soft ring-1 ring-primary/10'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
              </nav>

              <div className="border-t p-3">
                <Link
                  href={settingsItem.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                >
                  <SettingsIcon className="h-4 w-4 shrink-0" />
                  {settingsItem.label}
                </Link>
                <div className="mt-3 px-1">
                  <UserNav user={user} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
