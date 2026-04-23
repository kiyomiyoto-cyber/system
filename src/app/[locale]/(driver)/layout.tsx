import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LayoutDashboard, Package, User } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

interface DriverLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DriverLayout({ children, params }: DriverLayoutProps) {
  const { locale } = await params
  const user = await getAuthenticatedUser()

  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'driver') {
    if (['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
      redirect(`/${locale}/dashboard`)
    }
    if (user.role === 'client') redirect(`/${locale}/shipments`)
    redirect(`/${locale}/login`)
  }

  const t = await getTranslations('driver')

  const tabs = [
    { href: `/${locale}/my-shipments`, label: t('myShipments'), icon: Package },
    { href: `/${locale}/delivery`, label: t('delivery'), icon: LayoutDashboard },
    { href: `/${locale}/profile`, label: t('profile'), icon: User },
  ]

  return (
    <div className="flex h-dvh flex-col bg-background">
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
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="shrink-0 border-t bg-background">
        <ul className="grid grid-cols-3">
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
    </div>
  )
}
