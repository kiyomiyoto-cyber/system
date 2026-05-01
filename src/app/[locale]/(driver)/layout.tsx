import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Eye, Package } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { CaptureReceiptFab } from '@/components/accounting/capture-receipt-fab'
import { WorkSessionGate } from '@/components/work-sessions/work-session-gate'

interface DriverLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DriverLayout({ children, params }: DriverLayoutProps) {
  const { locale } = await params
  const user = await getAuthenticatedUser()

  if (!user) redirect(`/${locale}/login`)
  const allowedRoles = ['driver', 'super_admin', 'company_admin']
  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'dispatcher' || user.role === 'comptable') {
      redirect(`/${locale}/dashboard`)
    }
    if (user.role === 'client') redirect(`/${locale}/portal/shipments`)
    if (user.role === 'external_accountant') redirect(`/${locale}/accountant/dossiers`)
    redirect(`/${locale}/login`)
  }
  const isAdminPreview = user.role !== 'driver'

  const t = await getTranslations('driver')

  const tabs = [
    { href: `/${locale}/my-shipments`, label: t('myShipments'), icon: Package },
  ]

  return (
    <div className="flex h-dvh flex-col bg-background">
      {isAdminPreview && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Aperçu admin — vue chauffeur
          </span>
          <Link href={`/${locale}/dashboard`} className="inline-flex items-center gap-1 font-medium hover:underline">
            <ArrowLeft className="h-3.5 w-3.5 rtl-flip" />
            Tableau de bord
          </Link>
        </div>
      )}
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-foreground">TMS — {user.fullName.split(' ')[0]}</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <WorkSessionGate user={user}>{children}</WorkSessionGate>
      </main>

      {/* Bottom tab bar */}
      <nav className="shrink-0 border-t bg-background">
        <ul className="grid grid-cols-1">
          {tabs.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:text-primary"
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <CaptureReceiptFab userRole={user.role} companyId={user.companyId} />
    </div>
  )
}
