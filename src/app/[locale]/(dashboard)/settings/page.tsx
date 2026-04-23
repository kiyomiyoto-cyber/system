import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Building2, Users, DollarSign, Bell, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { getAuthenticatedUser } from '@/actions/auth'
import { redirect } from 'next/navigation'

export default async function SettingsIndexPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('settings'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const sections = [
    { href: `/${locale}/settings/company`, label: t('company'), description: t('companyDesc'), icon: Building2 },
    { href: `/${locale}/settings/users`, label: t('users'), description: t('usersDesc'), icon: Users },
    { href: `/${locale}/settings/pricing`, label: t('pricing'), description: t('pricingDesc'), icon: DollarSign },
    { href: `/${locale}/settings/notifications`, label: t('notifications'), description: t('notificationsDesc'), icon: Bell },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">{label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
