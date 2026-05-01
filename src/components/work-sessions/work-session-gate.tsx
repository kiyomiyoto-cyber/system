'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  LogIn,
  LogOut,
  Loader2,
  MapPin,
  MapPinOff,
  RotateCw,
  Sparkles,
} from 'lucide-react'
import {
  useActiveSession,
  useCheckIn,
  useOfficeGeofence,
} from '@/hooks/use-work-sessions'
import { distanceMeters } from '@/lib/geofence'
import type { AuthUser } from '@/types/app.types'
import { CheckOutDialog } from './check-out-dialog'

interface WorkSessionGateProps {
  user: AuthUser
  children: ReactNode
}

type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string }
  | {
      status: 'located'
      lat: number
      lng: number
      accuracy: number
      distance: number
      inside: boolean
    }

const TEAM_ROLES = ['dispatcher', 'driver', 'comptable']

export function WorkSessionGate({ user, children }: WorkSessionGateProps) {
  const t = useTranslations('workSessions')
  const isTeam = TEAM_ROLES.includes(user.role)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [widgetExpanded, setWidgetExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Hooks must be called unconditionally — gate behavior is enforced via flags.
  const { data: active, isLoading: activeLoading } = useActiveSession(
    user.id,
    isTeam,
  )
  const { data: geofence, isLoading: geofenceLoading } = useOfficeGeofence(isTeam)
  const checkIn = useCheckIn()

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({ status: 'unavailable', message: t('geo.unsupported') })
      return
    }
    setGeo({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        if (!geofence || !geofence.configured) {
          setGeo({
            status: 'located',
            lat: latitude,
            lng: longitude,
            accuracy,
            distance: 0,
            inside: false,
          })
          return
        }
        const distance = distanceMeters(
          { lat: latitude, lng: longitude },
          { lat: geofence.lat, lng: geofence.lng },
        )
        setGeo({
          status: 'located',
          lat: latitude,
          lng: longitude,
          accuracy,
          distance,
          inside: distance <= geofence.radiusMeters + (accuracy || 0),
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo({ status: 'denied', message: t('geo.denied') })
        } else {
          setGeo({
            status: 'unavailable',
            message: err.message || t('geo.unavailable'),
          })
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }, [geofence, t])

  // Auto-request location once we know we'll show the check-in card.
  useEffect(() => {
    if (!isTeam) return
    if (activeLoading || geofenceLoading) return
    if (active) return // already checked in
    if (geo.status === 'idle') requestLocation()
  }, [isTeam, activeLoading, geofenceLoading, active, geo.status, requestLocation])

  // Admins/clients/super_admin bypass the gate.
  if (!isTeam) return <>{children}</>

  if (activeLoading || geofenceLoading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  // ============================================================
  // No open session → show the check-in card.
  // ============================================================
  if (!active) {
    const geofenceMissing = !geofence || !geofence.configured
    const canCheckIn =
      !geofenceMissing &&
      geo.status === 'located' &&
      geo.inside &&
      !checkIn.isPending

    const onCheckIn = async () => {
      if (geo.status !== 'located') return
      try {
        await checkIn.mutateAsync({
          lat: geo.lat,
          lng: geo.lng,
          accuracy: geo.accuracy ?? null,
        })
        toast.success(t('checkIn.toastSuccess'), {
          description: t('checkIn.toastSuccessDescription'),
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('checkIn.toastError')
        toast.error(t('checkIn.toastError'), { description: message })
      }
    }

    const statusBlock = renderStatusBlock(geo, geofence, t, geofenceMissing)

    return (
      <div className="flex min-h-[70vh] flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border">
          <div className="border-b bg-gradient-to-br from-primary/5 to-primary/0 px-6 py-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Clock className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t('checkIn.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('checkIn.subtitle')}</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {statusBlock}

            {!geofenceMissing && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {geofence?.label ?? t('checkIn.officeFallbackLabel')}
                  </span>
                </span>
                {geofence?.mapsUrl && (
                  <a
                    href={geofence.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                  >
                    {t('checkIn.viewOnMap')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestLocation}
                disabled={geo.status === 'locating' || checkIn.isPending}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-ring disabled:opacity-50"
              >
                <RotateCw
                  className={`h-4 w-4 ${
                    geo.status === 'locating' ? 'animate-spin' : ''
                  }`}
                />
                {t('checkIn.refresh')}
              </button>
              <button
                type="button"
                onClick={onCheckIn}
                disabled={!canCheckIn}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 focus-ring disabled:opacity-50"
              >
                {checkIn.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {checkIn.isPending ? t('checkIn.submitting') : t('checkIn.submit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Open session → render children + floating check-out widget.
  // ============================================================
  return (
    <>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-3 end-3 z-[9998] max-w-[calc(100vw-1.5rem)] md:bottom-4 md:end-4">
            {widgetExpanded ? (
              <div className="relative w-[260px] overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        {t('widget.expandedHeader')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWidgetExpanded(false)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
                      aria-label={t('widget.collapse')}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-tight text-foreground">
                        {t('widget.title')}
                      </div>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {t('widget.subtitle')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 active:scale-[0.99] focus-ring"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('widget.cta')}
                  </button>

                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600 ring-1 ring-rose-100">
                      <Sparkles className="h-2.5 w-2.5" />
                      {t('widget.required')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {t('widget.beforeLeaving')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setWidgetExpanded(true)}
                title={t('widget.title')}
                className="group relative inline-flex h-9 items-center gap-1.5 rounded-full border bg-card pe-3 ps-2.5 shadow-soft-lg transition-all hover:border-primary/40 hover:shadow-xl focus-ring"
              >
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                  <LogOut className="h-3 w-3 text-primary" />
                  <span className="absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-card" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t('widget.cta')}
                </span>
                <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
              </button>
            )}
          </div>,
          document.body,
        )}
      <CheckOutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        sessionId={active.id}
      />
    </>
  )
}

function renderStatusBlock(
  geo: GeoState,
  geofence: { configured: boolean; radiusMeters?: number } | undefined,
  t: ReturnType<typeof useTranslations>,
  geofenceMissing: boolean,
) {
  if (geofenceMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <MapPinOff className="h-4 w-4" />
          {t('geo.geofenceMissingTitle')}
        </div>
        <p className="text-xs text-amber-900/80">{t('geo.geofenceMissingDescription')}</p>
      </div>
    )
  }

  switch (geo.status) {
    case 'idle':
    case 'locating':
      return (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{t('geo.locating')}</span>
        </div>
      )
    case 'denied':
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <MapPinOff className="h-4 w-4" />
            {t('geo.deniedTitle')}
          </div>
          <p className="text-xs text-rose-700/80">{geo.message}</p>
        </div>
      )
    case 'unavailable':
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <MapPinOff className="h-4 w-4" />
            {t('geo.unavailableTitle')}
          </div>
          <p className="text-xs text-amber-900/80">{geo.message}</p>
        </div>
      )
    case 'located':
      if (geo.inside) {
        return (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4" />
              {t('geo.insideTitle')}
            </div>
            <p className="text-xs text-emerald-700/80">
              {t('geo.insideDescription', {
                distance: Math.round(geo.distance),
                accuracy: Math.round(geo.accuracy),
              })}
            </p>
          </div>
        )
      }
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <MapPinOff className="h-4 w-4" />
            {t('geo.outsideTitle')}
          </div>
          <p className="text-xs text-rose-700/80">
            {t('geo.outsideDescription', {
              distance: Math.round(geo.distance),
              radius: geofence?.radiusMeters ?? 0,
            })}
          </p>
        </div>
      )
  }
}
