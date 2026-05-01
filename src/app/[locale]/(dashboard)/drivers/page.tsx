import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Plus, Truck, Star, AlertTriangle, Search, Phone, Mail,
  TrendingUp, ArrowRight, Users, Award,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { cn } from '@/lib/utils'

interface DriverRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  license_number: string | null
  license_expiry: string | null
  is_available: boolean
  total_deliveries: number | null
  on_time_delivery_rate: number | null
  average_rating: number | null
  created_at: string
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

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>
}) {
  const [t, locale, user, supabase, sp] = await Promise.all([
    getTranslations('drivers'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null

  let query = supabase
    .from('drivers')
    .select('id, full_name, phone, email, license_number, license_expiry, is_available, total_deliveries, on_time_delivery_rate, average_rating, created_at')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  if (sp.q) {
    query = query.or(`full_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,email.ilike.%${sp.q}%`)
  }
  if (sp.mode === 'available') query = query.eq('is_available', true)
  if (sp.mode === 'busy') query = query.eq('is_available', false)

  const { data: drivers } = await query

  const rows = (drivers ?? []) as DriverRow[]

  // Stats — computed on full unfiltered set to be representative; we'll rerun a small KPI query
  const today = new Date()
  const isLicenseExpiringSoon = (expiry: string | null) => {
    if (!expiry) return false
    const days = (new Date(expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return days < 60 && days >= 0
  }

  // For accurate KPIs, fetch the unfiltered set count
  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, is_available, on_time_delivery_rate, average_rating')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)

  const total = allDrivers?.length ?? 0
  const available = allDrivers?.filter((d) => (d as { is_available: boolean }).is_available).length ?? 0
  const ratedDrivers = (allDrivers ?? []).filter((d) => (d as { average_rating: number | null }).average_rating != null) as { average_rating: number }[]
  const avgRating = ratedDrivers.length > 0
    ? ratedDrivers.reduce((s, d) => s + d.average_rating, 0) / ratedDrivers.length
    : null
  const ratedOnTime = (allDrivers ?? []).filter((d) => (d as { on_time_delivery_rate: number | null }).on_time_delivery_rate != null) as { on_time_delivery_rate: number }[]
  const avgOnTime = ratedOnTime.length > 0
    ? ratedOnTime.reduce((s, d) => s + d.on_time_delivery_rate, 0) / ratedOnTime.length
    : null

  const activeMode = sp.mode ?? 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Link
            href={`/${locale}/drivers/new`}
            className="btn-cta focus-ring"
          >
            <Plus className="h-4 w-4" />
            {t('newDriver')}
          </Link>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.total')}
            value={total}
            subtitle={t('stats.totalSubtitle', { count: total })}
            icon={Users}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.available')}
            value={`${available}/${total}`}
            subtitle={t('stats.availableSubtitle')}
            icon={Truck}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.avgOnTime')}
            value={avgOnTime != null ? `${avgOnTime.toFixed(1)}%` : '—'}
            subtitle={t('stats.avgOnTimeSubtitle')}
            icon={TrendingUp}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.avgRating')}
            value={avgRating != null ? avgRating.toFixed(1) : '—'}
            subtitle={t('stats.avgRatingSubtitle')}
            icon={Award}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </StaggerItem>
      </Stagger>

      {/* Filter bar */}
      <FadeIn delay={0.16}>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form className="relative flex-1 sm:max-w-md">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={sp.q}
                placeholder={t('filter.search')}
                className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </form>
            <div className="flex rounded-lg border bg-background p-0.5">
              <FilterTab href={`/${locale}/drivers`} active={activeMode === 'all'} label={t('filter.all')} />
              <FilterTab
                href={`/${locale}/drivers?mode=available`}
                active={activeMode === 'available'}
                label={t('filter.available')}
              />
              <FilterTab
                href={`/${locale}/drivers?mode=busy`}
                active={activeMode === 'busy'}
                label={t('filter.busy')}
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Grid */}
      {total === 0 && !sp.q && !sp.mode ? (
        <FadeIn delay={0.2}>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-12 text-center shadow-soft">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Truck className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('noDrivers')}</p>
            <Link
              href={`/${locale}/drivers/new`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
            >
              <Plus className="h-4 w-4" />
              {t('newDriver')}
            </Link>
          </div>
        </FadeIn>
      ) : rows.length === 0 ? (
        <FadeIn delay={0.2}>
          <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noResults')}</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" delayChildren={0.2}>
          {rows.map((d) => {
            const expiringSoon = isLicenseExpiringSoon(d.license_expiry)
            return (
              <StaggerItem key={d.id}>
                <Link
                  href={`/${locale}/drivers/${d.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md"
                >
                  {/* Status stripe */}
                  <div
                    aria-hidden
                    className={cn(
                      'absolute inset-y-0 start-0 w-1',
                      d.is_available
                        ? 'bg-gradient-to-b from-emerald-500 via-emerald-500 to-emerald-300'
                        : 'bg-muted-foreground/30',
                    )}
                  />

                  {/* Header */}
                  <div className="flex items-start gap-3 border-b px-5 py-4 ps-6">
                    <div className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-105',
                      avatarTone(d.id),
                    )}>
                      {initials(d.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          d.is_available
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground',
                        )}>
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            d.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400',
                          )} />
                          {d.is_available ? t('available') : t('unavailable')}
                        </span>
                      </div>
                      <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
                        {d.full_name}
                      </h3>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-2.5 px-5 py-4 ps-6">
                    {d.phone && (
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{d.phone}</span>
                      </div>
                    )}
                    {d.email && (
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{d.email}</span>
                      </div>
                    )}

                    {/* Stats grid */}
                    <div className="mt-auto grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
                      <Stat
                        label={t('deliveries')}
                        value={`${d.total_deliveries ?? 0}`}
                      />
                      <Stat
                        label={t('onTime')}
                        value={`${d.on_time_delivery_rate?.toFixed(0) ?? 0}%`}
                      />
                      <Stat
                        label={t('rating')}
                        value={
                          <span className="inline-flex items-center gap-0.5">
                            {d.average_rating ? d.average_rating.toFixed(1) : '—'}
                            {d.average_rating ? (
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            ) : null}
                          </span>
                        }
                      />
                    </div>
                  </div>

                  {expiringSoon && (
                    <div className="border-t bg-amber-50 px-5 py-2.5 ps-6">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {t('licenseExpiringSoon')}
                      </div>
                    </div>
                  )}
                </Link>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
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
