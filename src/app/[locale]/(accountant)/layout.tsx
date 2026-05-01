import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { FolderOpen, Building2, Sparkles } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { UserNav } from '@/components/shared/user-nav'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

interface AccountantLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export default async function AccountantLayout({
  children,
  params,
}: AccountantLayoutProps) {
  const locale = (await Promise.resolve(params)).locale
  const user = await getAuthenticatedUser()

  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'external_accountant') {
    if (user.role === 'driver') redirect(`/${locale}/my-shipments`)
    if (user.role === 'client') redirect(`/${locale}/portal/shipments`)
    redirect(`/${locale}/dashboard`)
  }

  const t = await getTranslations('accountant.portal')

  // Resolve the company linked to this external accountant for branding.
  const supabase = await createClient()
  const { data: profileRaw } = await supabase
    .from('accountant_profiles')
    .select('cabinet_name, accountant_name, company:companies(id, name)')
    .eq('portal_user_id', user.id)
    .eq('has_portal_access', true)
    .maybeSingle()

  const profile = profileRaw as unknown as
    | {
        cabinet_name: string | null
        accountant_name: string
        company: { id: string; name: string } | null
      }
    | null
  const companyName = profile?.company?.name ?? '—'
  const cabinetName = profile?.cabinet_name ?? profile?.accountant_name ?? '—'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 px-4 py-3 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft-md ring-1 ring-primary/20">
              <FolderOpen className="h-5 w-5" />
              <span aria-hidden className="absolute -end-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-soft">
                <Sparkles className="h-2 w-2" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-foreground">
                {t('title')}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                <Building2 className="me-1 inline h-2.5 w-2.5" />
                {companyName}
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                {cabinetName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserNav user={user} />
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="border-b bg-card/40 px-4 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-1">
          <Link
            href={`/${locale}/accountant/dossiers`}
            className="border-b-2 border-primary px-3 py-2 text-sm font-semibold text-primary"
          >
            {t('nav.dossiers')}
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <footer className="border-t bg-card/40 px-4 py-3 text-center text-[11px] text-muted-foreground lg:px-8">
        {t('footer.notice')}
      </footer>
    </div>
  )
}
