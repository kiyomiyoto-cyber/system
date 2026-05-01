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
  Calculator,
  FileSignature,
  CalendarClock,
  Handshake,
  Zap,
  ClipboardCheck,
  Globe2,
  ScrollText,
  Radio,
  MessageCircle,
  Inbox,
  Building2,
  CreditCard,
  ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavIconKey } from './sidebar-toggle'

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  commandCenter: Radio,
  shipments: Package,
  clients: Users,
  drivers: Truck,
  vehicles: Car,
  invoices: FileText,
  accounting: Calculator,
  contracts: FileSignature,
  recurring: CalendarClock,
  subcontracting: Handshake,
  jit: Zap,
  freeZones: Globe2,
  cmr: ScrollText,
  whatsapp: MessageCircle,
  inbox: Inbox,
  suppliers: Building2,
  macaronsPeages: CreditCard,
  onboarding: ClipboardList,
  reports: BarChart3,
  presence: ClipboardCheck,
  settings: Settings,
}

interface NavItem {
  href: string
  label: string
  iconKey: NavIconKey
}

export interface NavSection {
  /** Optional small uppercase label rendered above the items. */
  label?: string
  items: NavItem[]
}

interface SidebarNavProps {
  /** Either a flat list of items, or grouped sections with optional labels. */
  items?: NavItem[]
  sections?: NavSection[]
  /** Optional id used by layoutId to scope the active indicator to this list. */
  layoutId?: string
}

/**
 * Client-side nav with an animated active indicator (layoutId).
 * Highlights the item whose href is a prefix of the current pathname.
 * Accepts either a flat `items` array or grouped `sections` with section labels.
 */
export function SidebarNav({ items, sections, layoutId = 'sidebar-active' }: SidebarNavProps) {
  const pathname = usePathname()
  const groups: NavSection[] = sections ?? (items ? [{ items }] : [])

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-0.5">
          {group.label && (
            <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, iconKey }) => {
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
        </div>
      ))}
    </div>
  )
}
