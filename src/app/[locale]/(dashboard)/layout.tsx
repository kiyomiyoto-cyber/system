import { redirect } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Car,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { UserNav } from '@/components/shared/user-nav'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { SidebarToggle } from './sidebar-toggle'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = await params
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (!['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    if (user.role === 'client') redirect(`/${locale}/shipments`)
    redirect(`/${locale}/login`)
  }

  const t = await getTranslations('nav')

  const navItems = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/shipments`, label: t('shipments'), icon: Package },
    { href: `/${locale}/clients`, label: t('clients'), icon: Users },
    { href: `/${locale}/drivers`, label: t('drivers'), icon: Truck },
    { href: `/${locale}/vehicles`, label: t('vehicles'), icon: Car },
    { href: `/${locale}/invoices`, label: t('invoices'), icon: FileText },
    { href: `/${locale}/reports`, label: t('reports'), icon: BarChart3 },
  ]

  const settingsItem = { href: `/${locale}/settings`, label: t('settings'), icon: Settings }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        id="sidebar"
        className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-foreground">TMS</p>
            <p className="text-xs text-muted-foreground leading-tight">Logistique</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom: settings + user */}
        <div className="border-t border-sidebar-border p-3">
          <Link
            href={settingsItem.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Settings className="h-4 w-4 shrink-0" />
            {settingsItem.label}
          </Link>
          <div className="mt-3 px-3">
            <UserNav user={user} />
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-bold text-foreground">TMS Logistique</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SidebarToggle navItems={navItems} settingsItem={settingsItem} user={user} />
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden h-16 items-center justify-between border-b bg-background px-6 lg:flex">
          <div /> {/* Breadcrumb goes here via each page */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
