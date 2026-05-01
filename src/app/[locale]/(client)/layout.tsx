import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Eye, FileText, Package } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { UserNav } from '@/components/shared/user-nav'

interface ClientLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function ClientLayout({ children, params }: ClientLayoutProps) {
  const { locale } = await params
  const user = await getAuthenticatedUser()

  if (!user) redirect(`/${locale}/login`)
  const allowedRoles = ['client', 'super_admin', 'company_admin']
  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'dispatcher' || user.role === 'comptable') {
      redirect(`/${locale}/dashboard`)
    }
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    redirect(`/${locale}/login`)
  }
  const isAdminPreview = user.role !== 'client'

  const t = await getTranslations('client')

  const tabs = [
    { href: `/${locale}/portal/shipments`, label: t('myShipments'), icon: Package },
    { href: `/${locale}/portal/invoices`, label: t('myInvoices'), icon: FileText },
  ]

  return (
    <div className="flex h-screen flex-col bg-background">
      {isAdminPreview && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Aperçu admin — vue client
          </span>
          <Link href={`/${locale}/dashboard`} className="inline-flex items-center gap-1 font-medium hover:underline">
            <ArrowLeft className="h-3.5 w-3.5 rtl-flip" />
            Tableau de bord
          </Link>
        </div>
      )}
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <span className="font-bold text-foreground">TMS Logistique</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <UserNav user={user} />
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="border-b bg-background">
        <ul className="flex px-4 sm:px-6">
          {tabs.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-2 border-b-2 border-transparent px-4 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
