import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Package, MapPin, ShieldCheck, Sparkles, Activity, Quote } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { Stagger, StaggerItem } from '@/components/motion/stagger'

export const metadata: Metadata = { title: 'Connexion · TMS Logistique' }

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth')

  const features = [
    { icon: MapPin, title: t('featureRealtimeTitle') },
    { icon: ShieldCheck, title: t('featureSecureTitle') },
    { icon: Sparkles, title: t('featureBillingTitle') },
  ]

  const stats = [
    { value: '12k+', label: t('statsShipments') },
    { value: '98%', label: t('statsOnTime') },
    { value: '40+', label: t('statsCarriers') },
  ]

  return (
    <div className="min-h-screen-safe grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand hero ───────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        {/* Layered gradient mesh background */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[hsl(221_90%_36%)] via-[hsl(221_83%_45%)] to-[hsl(231_75%_28%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -end-24 h-96 w-96 rounded-full bg-white/15 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -start-16 h-80 w-80 rounded-full bg-[hsl(var(--cta))]/35 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 start-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-300/15 blur-[90px]"
        />

        {/* Top: brand mark + live badge */}
        <div className="relative z-10 flex items-center justify-between">
          <FadeIn className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-md shadow-lg shadow-black/10">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">TMS Logistique</p>
              <p className="text-[11px] text-white/70">نظام إدارة الشحن</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/90">
              {t('liveTrackingBadge')}
            </span>
          </FadeIn>
        </div>

        {/* Middle: tagline + animated route map */}
        <div className="relative z-10">
          <FadeIn delay={0.05}>
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight xl:text-[2.75rem]">
              {t('tagline')}
              <br />
              <span className="bg-gradient-to-r from-[hsl(var(--cta))] to-amber-300 bg-clip-text text-transparent">
                {t('taglineAccent')}
              </span>
            </h2>
          </FadeIn>

          {/* Animated route preview */}
          <FadeIn delay={0.15} className="mt-8 max-w-md">
            <div className="relative rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    EXP-26-04812
                  </span>
                </div>
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/40">
                  in_transit
                </span>
              </div>

              <RoutePreview />

              <div className="mt-3 flex items-center justify-between text-[11px] text-white/70">
                <span className="font-medium">Casablanca</span>
                <span>·</span>
                <span>342 km</span>
                <span>·</span>
                <span className="font-medium">Tanger</span>
              </div>
            </div>
          </FadeIn>

          {/* Feature list — icon + title only */}
          <Stagger className="mt-8 flex flex-wrap gap-2" delayChildren={0.25}>
            {features.map(({ icon: Icon, title }) => (
              <StaggerItem
                key={title}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.08]"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">{title}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* Bottom: compact stats row + footer */}
        <div className="relative z-10 space-y-5">
          <FadeIn delay={0.35}>
            <div className="flex items-center gap-6">
              {stats.map((s, i) => (
                <div key={s.label} className="flex items-center gap-6">
                  {i > 0 && <span aria-hidden className="h-8 w-px bg-white/15" />}
                  <div>
                    <p className="text-xl font-bold leading-none tracking-tight">{s.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-white/55">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.45} className="flex items-center justify-between text-[11px] text-white/50">
            <span>© {new Date().getFullYear()} TMS Logistique</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('isoCompliance')}
            </span>
          </FadeIn>
        </div>
      </aside>

      {/* ── Form side ────────────────────────────────────────────── */}
      <div className="relative flex min-h-screen-safe items-center justify-center bg-gradient-to-br from-brand-50 via-background to-brand-100 p-4 sm:p-6 lg:p-10">
        {/* Subtle grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative w-full max-w-md">
          {/* Mobile brand mark */}
          <FadeIn className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(231_75%_38%)] text-white shadow-lg shadow-primary/30">
              <Package className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              TMS Logistique
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">نظام إدارة الشحن</p>
          </FadeIn>

          {children}
        </div>
      </div>
    </div>
  )
}

function RoutePreview() {
  return (
    <svg
      viewBox="0 0 320 70"
      className="h-14 w-full"
      role="img"
      aria-label="Route Casablanca → Tanger"
    >
      <defs>
        <linearGradient id="routeStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(255 255 255 / 0.25)" />
          <stop offset="50%" stopColor="rgb(255 255 255 / 0.55)" />
          <stop offset="100%" stopColor="rgb(255 255 255 / 0.25)" />
        </linearGradient>
        <linearGradient id="routeProgress" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--cta))" />
          <stop offset="100%" stopColor="rgb(252 211 77)" />
        </linearGradient>
      </defs>

      {/* Dashed base path */}
      <path
        d="M 16 50 Q 90 10 160 38 T 304 24"
        fill="none"
        stroke="url(#routeStroke)"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      {/* Progress overlay (animated draw) */}
      <path
        d="M 16 50 Q 90 10 160 38 T 304 24"
        fill="none"
        stroke="url(#routeProgress)"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="0.55 1"
        strokeDashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;-1.55"
          dur="6s"
          repeatCount="indefinite"
        />
      </path>

      {/* Origin pin */}
      <circle cx="16" cy="50" r="5" fill="white" />
      <circle cx="16" cy="50" r="2.5" fill="hsl(221 83% 45%)" />

      {/* Destination pin */}
      <circle cx="304" cy="24" r="5" fill="white" />
      <circle cx="304" cy="24" r="2.5" fill="hsl(var(--cta))" />

      {/* Animated truck dot */}
      <g>
        <circle r="4.5" fill="hsl(var(--cta))">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path="M 16 50 Q 90 10 160 38 T 304 24"
          />
        </circle>
        <circle r="9" fill="hsl(var(--cta))" opacity="0.35">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path="M 16 50 Q 90 10 160 38 T 304 24"
          />
          <animate
            attributeName="opacity"
            values="0.45;0.15;0.45"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  )
}
