import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Package } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { UserNav } from '@/components/shared/user-nav'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { PageTransition } from '@/components/motion/page-transition'
import { SidebarToggle, type NavIconKey } from './sidebar-toggle'
import { SidebarNav } from './sidebar-nav'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = params
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (!['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    if (user.role === 'client') redirect(`/${locale}/portal/shipments`)
    redirect(`/${locale}/login`)
  }

  const t = await getTranslations('nav')

  const navItems: Array<{ href: string; label: string; iconKey: NavIconKey }> = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), iconKey: 'dashboard' },
    { href: `/${locale}/shipments`, label: t('shipments'), iconKey: 'shipments' },
    { href: `/${locale}/clients`,   label: t('clients'),   iconKey: 'clients' },
    { href: `/${locale}/drivers`,   label: t('drivers'),   iconKey: 'drivers' },
    { href: `/${locale}/vehicles`,  label: t('vehicles'),  iconKey: 'vehicles' },
    { href: `/${locale}/invoices`,  label: t('invoices'),  iconKey: 'invoices' },
    { href: `/${locale}/reports`,   label: t('reports'),   iconKey: 'reports' },
  ]

  const settingsItem = {
    href: `/${locale}/settings`,
    label: t('settings'),
    iconKey: 'settings' as const,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        id="sidebar"
        className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft-md ring-1 ring-primary/20">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-foreground">TMS</p>
            <p className="text-xs text-muted-foreground leading-tight">Logistique</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <SidebarNav items={navItems} />
        </nav>

        {/* Bottom: settings + user */}
        <div className="border-t border-sidebar-border p-3">
          <SidebarNav items={[settingsItem]} layoutId="sidebar-bottom-active" />
          <div className="mt-3 px-1">
            <UserNav user={user} />
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
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
        <header className="hidden h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur lg:flex">
          <div />
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
