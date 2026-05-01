import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Building2,
  Truck,
  Users,
  Car,
  FileSignature,
  CreditCard,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

const ALLOWED_ROLES = ['super_admin', 'company_admin']

export const dynamic = 'force-dynamic'

interface OnboardingStep {
  key: string
  Icon: LucideIcon
  href: string
  done: boolean
  count: number
}

export default async function OnboardingPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('onboarding'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)
  const companyId = user.companyId

  const supabase = await createClient()

  const [companyRes, driversRes, vehiclesRes, clientsRes, contractsRes, suppliersRes] =
    await Promise.all([
      supabase
        .from('companies')
        .select('name, address, city, tax_id, slug')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('client_pricing_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
    ])

  type CompanyRow = {
    name: string
    address: string | null
    city: string | null
    tax_id: string | null
    slug: string
  }
  const company = companyRes.data as unknown as CompanyRow | null
  const companyConfigured = Boolean(
    company?.name && company?.address && company?.city && company?.tax_id,
  )

  const steps: OnboardingStep[] = [
    {
      key: 'company',
      Icon: Building2,
      href: `/${locale}/settings`,
      done: companyConfigured,
      count: companyConfigured ? 1 : 0,
    },
    {
      key: 'drivers',
      Icon: Users,
      href: `/${locale}/drivers`,
      done: (driversRes.count ?? 0) >= 1,
      count: driversRes.count ?? 0,
    },
    {
      key: 'vehicles',
      Icon: Car,
      href: `/${locale}/vehicles`,
      done: (vehiclesRes.count ?? 0) >= 1,
      count: vehiclesRes.count ?? 0,
    },
    {
      key: 'clients',
      Icon: Truck,
      href: `/${locale}/clients`,
      done: (clientsRes.count ?? 0) >= 1,
      count: clientsRes.count ?? 0,
    },
    {
      key: 'contracts',
      Icon: FileSignature,
      href: `/${locale}/contrats`,
      done: (contractsRes.count ?? 0) >= 1,
      count: contractsRes.count ?? 0,
    },
    {
      key: 'suppliers',
      Icon: Building2,
      href: `/${locale}/fournisseurs`,
      done: (suppliersRes.count ?? 0) >= 1,
      count: suppliersRes.count ?? 0,
    },
    {
      key: 'macarons',
      Icon: CreditCard,
      href: `/${locale}/macarons-peages`,
      done: false, // optional — never marked "done"
      count: 0,
    },
  ]

  const required = steps.slice(0, 6)
  const completed = required.filter((s) => s.done).length
  const total = required.length
  const progressPct = Math.round((completed / total) * 100)
  const allDone = completed === total

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ring-1',
              allDone
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-primary/10 text-primary ring-primary/20',
            )}
          >
            {allDone ? <Sparkles className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
            {t('page.progress', { done: completed, total })}
          </span>
        }
      />

      <div className="rounded-xl border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {allDone ? t('progress.allDone') : t('progress.label')}
          </p>
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {progressPct}%
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              allDone ? 'bg-emerald-500' : 'bg-primary',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {steps.map((s, idx) => (
          <Link
            key={s.key}
            href={s.href}
            className={cn(
              'group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-soft transition-colors hover:bg-muted/30 focus-ring',
              s.done && 'border-emerald-200 bg-emerald-50/30',
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
                s.done
                  ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                  : 'bg-primary/10 text-primary ring-primary/20',
              )}
            >
              <s.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('step.number', { n: idx + 1 })}
                </span>
                {s.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
              <h3 className="mt-0.5 text-sm font-bold text-foreground">
                {t(`step.${s.key}.title`)}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`step.${s.key}.description`)}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    s.done ? 'text-emerald-700' : 'text-muted-foreground',
                  )}
                >
                  {s.done
                    ? t(`step.${s.key}.done`, { count: s.count })
                    : t(`step.${s.key}.todo`)}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                  {t('step.action')}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {allDone && (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center shadow-soft">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-2 text-base font-bold text-emerald-900">
            {t('completed.title')}
          </h3>
          <p className="mt-1 text-sm text-emerald-800">{t('completed.subtitle')}</p>
          <Link
            href={`/${locale}/dashboard`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-ring"
          >
            {t('completed.cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
