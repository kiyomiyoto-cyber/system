import type { Metadata } from 'next'
import { Package, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { Stagger, StaggerItem } from '@/components/motion/stagger'

export const metadata: Metadata = { title: 'Connexion' }

const FEATURES = [
  {
    icon: MapPin,
    title: 'Suivi temps réel',
    desc: 'Localisation live des expéditions et chauffeurs sur la carte.',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité multi-tenant',
    desc: 'Chaque transporteur isolé par Row-Level Security Supabase.',
  },
  {
    icon: Sparkles,
    title: 'Facturation automatique',
    desc: 'Génération PDF, groupage mensuel, relances automatisées.',
  },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen-safe grid lg:grid-cols-2">
      {/* ── Brand hero (LTR: left, RTL: right via grid order reverse) ─ */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Decorative layers */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -end-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -start-10 h-72 w-72 rounded-full bg-[hsl(var(--cta))]/25 blur-3xl"
        />

        <FadeIn className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">TMS Logistique</p>
            <p className="text-xs text-white/70">نظام إدارة الشحن</p>
          </div>
        </FadeIn>

        <div className="relative z-10">
          <FadeIn delay={0.05}>
            <h2 className="text-3xl font-bold leading-tight tracking-tight">
              La plateforme de gestion du transport
              <br />
              <span className="text-[hsl(var(--cta))]">pensée pour le Maroc.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-white/75">
              Expéditions, chauffeurs, clients, factures — tout votre flux
              logistique en un seul outil, bilingue FR / AR.
            </p>
          </FadeIn>

          <Stagger className="mt-10 space-y-4" delayChildren={0.15}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <StaggerItem
                key={title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-white/70">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <FadeIn delay={0.25} className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} TMS Logistique · Casablanca, Maroc
        </FadeIn>
      </aside>

      {/* ── Form side ────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-brand-50 via-background to-brand-100 p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <FadeIn className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-soft-md">
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
