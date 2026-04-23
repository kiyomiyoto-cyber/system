import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Package, FileText } from 'lucide-react'
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
  if (user.role !== 'client') {
    if (['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
      redirect(`/${locale}/dashboard`)
    }
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    redirect(`/${locale}/login`)
  }

  const t = await getTranslations('client')

  const tabs = [
    { href: `/${locale}/shipments`, label: t('myShipments'), icon: Package },
    { href: `/${locale}/invoices`, label: t('myInvoices'), icon: FileText },
  ]

  return (
    <div className="flex h-screen flex-col bg-background">
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
