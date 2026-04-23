'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
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
import type { NavIconKey } from './sidebar-toggle'

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

interface SidebarNavProps {
  items: NavItem[]
  /** Optional id used by layoutId to scope the active indicator to this list. */
  layoutId?: string
}

/**
 * Client-side nav list with an animated active indicator (layoutId).
 * Highlights the item whose href is a prefix of the current pathname.
 */
export function SidebarNav({ items, layoutId = 'sidebar-active' }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <ul className="space-y-0.5">
      {items.map(({ href, label, iconKey }) => {
        const Icon = ICONS[iconKey]
        const isActive =
          pathname === href || pathname.startsWith(href + '/') || pathname.endsWith(href)

        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring',
                isActive
                  ? 'text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 -z-0 rounded-lg bg-white shadow-soft ring-1 ring-primary/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                    isActive && 'text-primary',
                  )}
                />
                {label}
              </span>
              {isActive && (
                <motion.span
                  layoutId={`${layoutId}-dot`}
                  className="relative z-10 ms-auto h-1.5 w-1.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
