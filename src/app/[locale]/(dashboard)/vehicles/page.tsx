import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Plus, Car, AlertTriangle, User, Search, ArrowRight,
  Wrench, Shield, Gauge, Box, Bike, Truck as TruckIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { FadeIn } from '@/components/motion/fade-in'
import { cn } from '@/lib/utils'

interface VehicleRow {
  id: string
  plate_number: string
  type: 'motorcycle' | 'van' | 'truck' | 'pickup'
  brand: string
  model: string
  year: number | null
  color: string | null
  max_weight_kg: number | null
  volume_m3: number | null
  insurance_expiry: string | null
  registration_expiry: string | null
  next_maintenance_date: string | null
  is_available: boolean
  is_active: boolean
  driver: { id: string; full_name: string } | null
}

const TYPE_ICON: Record<VehicleRow['type'], typeof Car> = {
  motorcycle: Bike,
  van: Box,
  pickup: Car,
  truck: TruckIcon,
}

const TYPE_TONE: Record<VehicleRow['type'], string> = {
  motorcycle: 'bg-rose-100 text-rose-700',
  van: 'bg-blue-100 text-blue-700',
  pickup: 'bg-amber-100 text-amber-700',
  truck: 'bg-emerald-100 text-emerald-700',
}

function isExpiringSoon(date: string | null, days = 60): boolean {
  if (!date) return false
  const diff = (new Date(date).getTime() - Date.now()) / 86_400_000
  return diff < days && diff >= -1
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>
}) {
  const [t, locale, user, supabase, sp] = await Promise.all([
    getTranslations('vehicles'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null

  let query = supabase
    .from('vehicles')
    .select(`
      id, plate_number, type, brand, model, year, color,
      max_weight_kg, volume_m3,
      insurance_expiry, registration_expiry, next_maintenance_date,
      is_available, is_active,
      driver:drivers(id, full_name)
    `)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('plate_number', { ascending: true })

  if (sp.q) {
    query = query.or(`plate_number.ilike.%${sp.q}%,brand.ilike.%${sp.q}%,model.ilike.%${sp.q}%`)
  }
  if (sp.mode === 'available') query = query.eq('is_available', true)

  const { data: vehiclesRaw } = await query
  const allVehiclesRes = await supabase
    .from('vehicles')
    .select('id, max_weight_kg, is_available, insurance_expiry, registration_expiry')
    .eq('company_id', user.companyId)
    .is('deleted_at', null)

  const vehicles = (vehiclesRaw ?? []) as unknown as VehicleRow[]
  const allVehicles = (allVehiclesRes.data ?? []) as Array<{
    id: string; max_weight_kg: number | null; is_available: boolean
    insurance_expiry: string | null; registration_expiry: string | null
  }>

  // Apply expiring filter at JS level (need to inspect either insurance OR registration)
  const expiringFilter = sp.mode === 'expiring'
  const visibleVehicles = expiringFilter
    ? vehicles.filter((v) =>
        isExpiringSoon(v.insurance_expiry) || isExpiringSoon(v.registration_expiry),
      )
    : vehicles

  // KPIs
  const total = allVehicles.length
  const available = allVehicles.filter((v) => v.is_available).length
  const expiringCount = allVehicles.filter((v) =>
    isExpiringSoon(v.insurance_expiry) || isExpiringSoon(v.registration_expiry),
  ).length
  const totalCapacity = allVehicles.reduce((s, v) => s + Number(v.max_weight_kg ?? 0), 0)

  const activeMode = sp.mode ?? 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Link
            href={`/${locale}/vehicles/new`}
            className="btn-cta focus-ring"
          >
            <Plus className="h-4 w-4" />
            {t('newVehicle')}
          </Link>
        }
      />

      {/* KPI strip */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delayChildren={0.05}>
        <StaggerItem>
          <KPICard
            title={t('stats.total')}
            value={total}
            subtitle={t('stats.totalSubtitle')}
            icon={Car}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.available')}
            value={`${available}/${total}`}
            subtitle={t('stats.availableSubtitle')}
            icon={Gauge}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.documentsExpiring')}
            value={expiringCount}
            subtitle={t('stats.documentsExpiringSubtitle')}
            icon={AlertTriangle}
            iconColor={expiringCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
            iconBg={expiringCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            title={t('stats.totalCapacity')}
            value={totalCapacity > 0 ? `${(totalCapacity / 1000).toFixed(1)} t` : '—'}
            subtitle={t('stats.totalCapacitySubtitle')}
            icon={Box}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
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
              <FilterTab href={`/${locale}/vehicles`} active={activeMode === 'all'} label={t('filter.all')} />
              <FilterTab
                href={`/${locale}/vehicles?mode=available`}
                active={activeMode === 'available'}
                label={t('filter.available')}
              />
              <FilterTab
                href={`/${locale}/vehicles?mode=expiring`}
                active={activeMode === 'expiring'}
                label={t('filter.expiring')}
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
              <Car className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('noVehicles')}</p>
            <Link
              href={`/${locale}/vehicles/new`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:shadow-soft-md"
            >
              <Plus className="h-4 w-4" />
              {t('newVehicle')}
            </Link>
          </div>
        </FadeIn>
      ) : visibleVehicles.length === 0 ? (
        <FadeIn delay={0.2}>
          <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noResults')}</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" delayChildren={0.2}>
          {visibleVehicles.map((v) => {
            const TypeIcon = TYPE_ICON[v.type] ?? Car
            const insuranceExp = isExpiringSoon(v.insurance_expiry)
            const registrationExp = isExpiringSoon(v.registration_expiry)
            const maintenanceDue = isExpiringSoon(v.next_maintenance_date, 14)
            const insuranceDays = daysUntil(v.insurance_expiry)

            return (
              <StaggerItem key={v.id}>
                <Link
                  href={`/${locale}/vehicles/${v.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md"
                >
                  {/* Status stripe */}
                  <div
                    aria-hidden
                    className={cn(
                      'absolute inset-y-0 start-0 w-1',
                      v.is_available
                        ? 'bg-gradient-to-b from-emerald-500 via-emerald-500 to-emerald-300'
                        : 'bg-muted-foreground/30',
                    )}
                  />

                  {/* Header */}
                  <div className="flex items-start gap-3 border-b px-5 py-4 ps-6">
                    <div className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                      TYPE_TONE[v.type],
                    )}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          v.is_available
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground',
                        )}>
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            v.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400',
                          )} />
                          {v.is_available ? t('available') : t('unavailable')}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(`types.${v.type}`)}
                        </span>
                      </div>
                      <h3 className="truncate font-mono text-base font-bold text-foreground group-hover:text-primary">
                        {v.plate_number}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.brand} {v.model}
                        {v.year && <span> · {v.year}</span>}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-3 px-5 py-4 ps-6">
                    {/* Capacity */}
                    {(v.max_weight_kg || v.volume_m3) && (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                        {v.max_weight_kg && (
                          <div className="flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t('capacity')}
                            </p>
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              {v.max_weight_kg.toLocaleString('fr-MA')} kg
                            </p>
                          </div>
                        )}
                        {v.volume_m3 && (
                          <div className="flex-1 border-s ps-3">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t('volume')}
                            </p>
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              {v.volume_m3} m³
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Driver assignment */}
                    <div className="inline-flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {v.driver ? (
                        <span className="truncate font-medium text-foreground">{v.driver.full_name}</span>
                      ) : (
                        <span className="italic text-muted-foreground">{t('noDriverAssigned')}</span>
                      )}
                    </div>
                  </div>

                  {/* Warnings footer */}
                  {(insuranceExp || registrationExp || maintenanceDue) && (
                    <div className="border-t bg-amber-50/60 px-5 py-2.5 ps-6">
                      <div className="space-y-1">
                        {insuranceExp && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                            <Shield className="h-3 w-3" />
                            {t('insuranceExpiringSoon')}
                            {insuranceDays != null && (
                              <span className="text-amber-700/70">
                                ({insuranceDays >= 0 ? `${insuranceDays}j` : 'expirée'})
                              </span>
                            )}
                          </div>
                        )}
                        {registrationExp && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                            <AlertTriangle className="h-3 w-3" />
                            {t('techControlExpiringSoon')}
                          </div>
                        )}
                        {maintenanceDue && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                            <Wrench className="h-3 w-3" />
                            Entretien à prévoir
                          </div>
                        )}
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
