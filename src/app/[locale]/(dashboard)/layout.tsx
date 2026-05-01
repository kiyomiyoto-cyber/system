import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Package, Sparkles } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { getViewAsRole } from '@/actions/view-as'
import { UserNav } from '@/components/shared/user-nav'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { PageTransition } from '@/components/motion/page-transition'
import { CaptureReceiptFab } from '@/components/accounting/capture-receipt-fab'
import { WorkSessionGate } from '@/components/work-sessions/work-session-gate'
import { ViewAsBanner } from '@/components/shared/view-as-banner'
import { SidebarToggle, type NavIconKey } from './sidebar-toggle'
import { SidebarNav, type NavSection } from './sidebar-nav'

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

  if (!['super_admin', 'company_admin', 'dispatcher', 'comptable'].includes(user.role)) {
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    if (user.role === 'client') redirect(`/${locale}/portal/shipments`)
    redirect(`/${locale}/login`)
  }

  const t = await getTranslations('nav')

  // ── Effective role: admins can preview the app as dispatcher / comptable
  // via a server-set cookie. Non-admins always see their real role.
  const realIsAdmin = ['super_admin', 'company_admin'].includes(user.role)
  const viewAs = realIsAdmin ? await getViewAsRole() : null
  const effectiveRole = viewAs ?? user.role

  const isAdmin = ['super_admin', 'company_admin'].includes(effectiveRole)
  const isDispatcher = effectiveRole === 'dispatcher'
  const isComptable = effectiveRole === 'comptable'

  // Per-role tab whitelist. Admin sees everything; dispatcher and comptable
  // each see only what their role needs.
  const showCommandCenter  = isAdmin || isDispatcher
  const showShipments      = isAdmin || isDispatcher || isComptable
  const showClients        = isAdmin || isDispatcher || isComptable
  const showContracts      = isAdmin || isDispatcher || isComptable
  const showInvoices       = isAdmin || isDispatcher || isComptable
  const showReports        = isAdmin || isDispatcher || isComptable
  const showJit            = isAdmin || isDispatcher
  const showRecurring      = isAdmin || isDispatcher
  const showSubcontracting = isAdmin || isDispatcher
  const showFreeZones      = isAdmin || isDispatcher
  const showCmr            = (isAdmin || isDispatcher || isComptable) &&
                             process.env.NEXT_PUBLIC_INTERNATIONAL_ENABLED === 'true'
  const showWhatsapp       = isAdmin || isDispatcher || isComptable
  const showInbox          = isAdmin || isDispatcher || isComptable
  const showSuppliers      = isAdmin || isDispatcher || isComptable
  const showMacarons       = isAdmin || isDispatcher || isComptable
  const showOnboarding     = isAdmin
  const showDrivers        = isAdmin || isDispatcher
  const showVehicles       = isAdmin || isDispatcher
  const showAccounting     = isAdmin || isComptable
  const showPresence       = isAdmin
  type Item = { href: string; label: string; iconKey: NavIconKey }

  const operationsItems: Item[] = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), iconKey: 'dashboard' },
    ...(showCommandCenter ? [{ href: `/${locale}/centre-commandement`, label: t('commandCenter'), iconKey: 'commandCenter' as const }] : []),
    ...(showShipments ? [{ href: `/${locale}/shipments`, label: t('shipments'), iconKey: 'shipments' as const }] : []),
    ...(showJit ? [{ href: `/${locale}/jit`, label: t('jit'), iconKey: 'jit' as const }] : []),
    ...(showRecurring ? [{ href: `/${locale}/recurring`, label: t('recurring'), iconKey: 'recurring' as const }] : []),
    ...(showSubcontracting ? [{ href: `/${locale}/sous-traitance`, label: t('subcontracting'), iconKey: 'subcontracting' as const }] : []),
    ...(showFreeZones ? [{ href: `/${locale}/zones-franches`, label: t('freeZones'), iconKey: 'freeZones' as const }] : []),
    ...(showCmr ? [{ href: `/${locale}/cmr`, label: t('cmr'), iconKey: 'cmr' as const }] : []),
    ...(showWhatsapp ? [{ href: `/${locale}/whatsapp`, label: t('whatsapp'), iconKey: 'whatsapp' as const }] : []),
    ...(showInbox ? [{ href: `/${locale}/inbox`, label: t('inbox'), iconKey: 'inbox' as const }] : []),
  ]

  const commercialItems: Item[] = [
    ...(showClients ? [{ href: `/${locale}/clients`, label: t('clients'), iconKey: 'clients' as const }] : []),
    ...(showContracts ? [{ href: `/${locale}/contrats`, label: t('contracts'), iconKey: 'contracts' as const }] : []),
  ]

  const resourcesItems: Item[] = [
    ...(showDrivers ? [{ href: `/${locale}/drivers`, label: t('drivers'), iconKey: 'drivers' as const }] : []),
    ...(showVehicles ? [{ href: `/${locale}/vehicles`, label: t('vehicles'), iconKey: 'vehicles' as const }] : []),
    ...(showSuppliers ? [{ href: `/${locale}/fournisseurs`, label: t('suppliers'), iconKey: 'suppliers' as const }] : []),
    ...(showMacarons ? [{ href: `/${locale}/macarons-peages`, label: t('macaronsPeages'), iconKey: 'macaronsPeages' as const }] : []),
    ...(showPresence ? [{ href: `/${locale}/presence`, label: t('presence'), iconKey: 'presence' as const }] : []),
  ]

  const financeItems: Item[] = [
    ...(showInvoices ? [{ href: `/${locale}/invoices`, label: t('invoices'), iconKey: 'invoices' as const }] : []),
    ...(showAccounting ? [{ href: `/${locale}/comptabilite`, label: t('accounting'), iconKey: 'accounting' as const }] : []),
  ]

  const insightsItems: Item[] = [
    ...(showReports ? [{ href: `/${locale}/reports`, label: t('reports'), iconKey: 'reports' as const }] : []),
    ...(showOnboarding ? [{ href: `/${locale}/onboarding`, label: t('onboarding'), iconKey: 'onboarding' as const }] : []),
  ]

  const sidebarSections: NavSection[] = [
    { label: t('sectionOperations'), items: operationsItems },
    { label: t('sectionCommercial'), items: commercialItems },
    { label: t('sectionResources'), items: resourcesItems },
    { label: t('sectionFinance'), items: financeItems },
    { label: t('sectionInsights'), items: insightsItems },
  ].filter((s) => s.items.length > 0)

  // Flat list for the mobile drawer (no sections, more compact)
  const navItems: Item[] = [
    ...operationsItems,
    ...commercialItems,
    ...resourcesItems,
    ...financeItems,
    ...insightsItems,
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
        <Link
          href={`/${locale}/dashboard`}
          className="group flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 transition-colors hover:bg-sidebar-accent/40"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft-md ring-1 ring-primary/20 transition-transform group-hover:scale-105">
            <Package className="h-5 w-5" />
            <span aria-hidden className="absolute -end-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-soft">
              <Sparkles className="h-2 w-2" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-sidebar-foreground">TMS</p>
            <p className="truncate text-xs leading-tight text-muted-foreground">Logistique</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <SidebarNav sections={sidebarSections} />
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
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b bg-background/70 px-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 font-medium text-muted-foreground shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">{new Date().toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </header>

        {viewAs && <ViewAsBanner role={viewAs} locale={locale} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <WorkSessionGate user={user}>
            <PageTransition>{children}</PageTransition>
          </WorkSessionGate>
        </main>
      </div>

      <CaptureReceiptFab userRole={user.role} companyId={user.companyId} />
    </div>
  )
}
