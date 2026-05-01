import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Plus, Users, Search, Phone, Mail, MapPin, Calendar,
  ArrowRight, TrendingUp, Wallet, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { formatDate, formatMAD } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

interface ClientRow {
  id: string
  business_name: string
  ice: string | null
  phone: string | null
  email: string | null
  city: string | null
  billing_mode: 'per_shipment' | 'monthly_grouped'
  payment_terms_days: number
  created_at: string
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
] as const

function avatarTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>
}) {
  const [t, tCommon, locale, user, supabase, sp] = await Promise.all([
    getTranslations('clients'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null
  const companyId = user.companyId
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  let query = supabase
    .from('clients')
    .select('id, business_name, ice, phone, email, city, billing_mode, payment_terms_days, created_at')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('business_name', { ascending: true })

  if (sp.q) {
    query = query.or(`business_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,ice.ilike.%${sp.q}%`)
  }
  if (sp.mode === 'per_shipment' || sp.mode === 'monthly_grouped') {
    query = query.eq('billing_mode', sp.mode)
  }

  // For activity stats: shipments in the last 30 days, grouped by client
  const thirtyDaysAgo = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const startOfMonth = (() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()

  const [{ data: clients }, { data: monthlyShipments }, { count: totalCount }] = await Promise.all([
    query.limit(100),
    supabase
      .from('shipments')
      .select('client_id, price_incl_tax, created_at')
      .eq('company_id', companyId)
      .gte('created_at', thirtyDaysAgo)
      .is('deleted_at', null),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null),
  ])

  const allClients = (clients ?? []) as ClientRow[]
  const shipmentsByClient = new Map<string, { count: number; revenue: number; thisMonth: number }>()
  for (const s of monthlyShipments ?? []) {
    const id = (s as { client_id: string }).client_id
    const created = (s as { created_at: string }).created_at
    const price = Number((s as { price_incl_tax: number | null }).price_incl_tax ?? 0)
    const entry = shipmentsByClient.get(id) ?? { count: 0, revenue: 0, thisMonth: 0 }
    entry.count++
    entry.revenue += price
    if (created >= startOfMonth) entry.thisMonth++
    shipmentsByClient.set(id, entry)
  }

  const activeCount = shipmentsByClient.size
  const topClient = (() => {
    let best: { name: string; revenue: number } | null = null
    for (const [id, stat] of shipmentsByClient.entries()) {
      const c = allClients.find((cli) => cli.id === id)
      if (!c) continue
      if (!best || stat.revenue > best.revenue) best = { name: c.business_name, revenue: stat.revenue }
    }
    return best
  })()

  const avgPaymentTerms = allClients.length > 0
    ? Math.round(allClients.reduce((s, c) => s + c.payment_terms_days, 0) / allClients.length)
    : 0

  const activeMode = sp.mode ?? 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Link
            href={`/${locale}/clients/new`}
            className="btn-cta focus-ring"
          >
            <Plus className="h-4 w-4" />
            {t('newClient')}
          </Link>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.total')}
            value={totalCount ?? 0}
            subtitle={t('stats.totalSubtitle', { count: totalCount ?? 0 })}
            icon={Users}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.active')}
            value={activeCount}
            subtitle={t('stats.activeSubtitle')}
            icon={TrendingUp}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.topRevenue')}
            value={topClient ? formatMAD(topClient.revenue) : '—'}
            subtitle={topClient?.name ?? t('stats.topRevenueSubtitle')}
            icon={Wallet}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.avgPaymentTerms')}
            value={`${avgPaymentTerms}j`}
            subtitle={t('stats.avgPaymentTermsSubtitle')}
            icon={Calendar}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Filters bar */}
      <FadeIn delay={0.16}>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form className="relative flex-1 sm:max-w-md">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={sp.q}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </form>
            <div className="flex rounded-lg border bg-background p-0.5">
              <ModeTab href={`/${locale}/clients`} active={activeMode === 'all'} label={t('filter.all')} />
              <ModeTab
                href={`/${locale}/clients?mode=per_shipment`}
                active={activeMode === 'per_shipment'}
                label={t('filter.perShipment')}
              />
              <ModeTab
                href={`/${locale}/clients?mode=monthly_grouped`}
                active={activeMode === 'monthly_grouped'}
                label={t('filter.monthlyGrouped')}
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Grid */}
      {allClients.length === 0 && !sp.q && !sp.mode ? (
        <FadeIn delay={0.2}>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-12 text-center shadow-soft">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('noClients')}</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{t('noClientsHint')}</p>
            <Link
              href={`/${locale}/clients/new`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
            >
              <Plus className="h-4 w-4" />
              {t('newClient')}
            </Link>
          </div>
        </FadeIn>
      ) : allClients.length === 0 ? (
        <FadeIn delay={0.2}>
          <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noResults')}</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" delayChildren={0.2}>
          {allClients.map((c) => {
            const stat = shipmentsByClient.get(c.id) ?? { count: 0, revenue: 0, thisMonth: 0 }
            return (
              <StaggerItem key={c.id}>
                <Link
                  href={`/${locale}/clients/${c.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 border-b px-5 py-4">
                    <div className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-105',
                      avatarTone(c.id),
                    )}>
                      {initials(c.business_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
                        {c.business_name}
                      </h3>
                      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {c.ice ? `ICE ${c.ice}` : tCommon('createdAt') + ' ' + formatDate(c.created_at, dateLocale)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-2.5 px-5 py-4">
                    {c.phone && (
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{c.email}</span>
                      </div>
                    )}
                    {c.city && (
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{c.city}</span>
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        c.billing_mode === 'per_shipment'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-purple-50 text-purple-700',
                      )}>
                        {c.billing_mode === 'per_shipment' ? t('perShipment') : t('monthlyGrouped')}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {c.payment_terms_days === 0 ? t('immediate') : `${c.payment_terms_days}j`}
                      </span>
                    </div>
                  </div>

                  {/* Footer activity */}
                  <div className="border-t bg-muted/20 px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={cn(
                        'inline-flex items-center gap-1',
                        stat.thisMonth > 0 ? 'text-emerald-700' : 'text-muted-foreground',
                      )}>
                        <TrendingUp className="h-3 w-3" />
                        {stat.thisMonth > 0
                          ? t('card.shipmentsThisMonth', { count: stat.thisMonth })
                          : t('card.noActivity')}
                      </span>
                      {stat.revenue > 0 && (
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatMAD(stat.revenue)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </div>
  )
}

function ModeTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'bg-primary text-primary-foreground shadow-soft'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}
