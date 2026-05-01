'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Mail, Lock, ShieldCheck, Languages, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { signIn } from '@/actions/auth'

const LoginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(6, 'Mot de passe requis'),
  remember: z.boolean().optional(),
})
type LoginForm = z.infer<typeof LoginSchema>

const ROLE_REDIRECTS: Record<string, string> = {
  super_admin: '/dashboard',
  company_admin: '/dashboard',
  dispatcher: '/dashboard',
  comptable: '/dashboard',
  driver: '/my-shipments',
  client: '/portal/shipments',
  external_accountant: '/accountant/dossiers',
}

const ease = [0.22, 1, 0.36, 1] as const

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { remember: true },
  })

  const otherLocale = locale === 'fr' ? 'ar' : 'fr'
  const otherLocaleHref = pathname.replace(`/${locale}`, `/${otherLocale}`)

  async function onSubmit(values: LoginForm) {
    setServerError(null)
    const result = await signIn(values.email, values.password)

    if (result.error) {
      setServerError(result.error)
      toast.error(result.error)
      return
    }

    const redirect = ROLE_REDIRECTS[result.data.role]
    if (!redirect) {
      const msg = `Rôle non reconnu (${result.data.role}). Contactez votre administrateur.`
      setServerError(msg)
      toast.error(msg)
      return
    }
    toast.success(t('loginSuccess'))
    router.push(`/${locale}${redirect}`)
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      className="relative"
    >
      {/* Locale switcher — top right of card */}
      <div className="mb-4 flex justify-end">
        <Link
          href={otherLocaleHref}
          aria-label={t('language')}
          className="group inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-all hover:border-primary/30 hover:text-foreground"
        >
          <Languages className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
          {otherLocale === 'fr' ? t('languageFr') : t('languageAr')}
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-3xl border bg-card/95 p-7 shadow-[0_20px_60px_-20px_hsl(221_83%_53%/0.18)] backdrop-blur-xl sm:p-9">
        {/* Card top accent bar */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[hsl(231_75%_55%)] to-[hsl(var(--cta))]"
        />

        <div className="mb-7">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t('login')}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        </div>

        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-snug">{serverError}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate autoComplete="off">
          {/* Email */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.05 }}
            className="space-y-1.5"
          >
            <label htmlFor="email" className="block text-sm font-semibold text-foreground">
              {t('email')}
            </label>
            <div className="group relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center ps-3.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="off"
                autoFocus
                aria-invalid={!!errors.email}
                {...register('email')}
                className="peer h-11 w-full rounded-xl border border-input bg-background/60 px-3 py-2 ps-10 text-sm shadow-sm ring-offset-background transition-all placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15"
                placeholder={t('emailPlaceholder')}
              />
            </div>
            {errors.email && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.email.message}
              </p>
            )}
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.1 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                {t('password')}
              </label>
              <Link
                href={`/${locale}/login`}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            </div>
            <div className="group relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center ps-3.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register('password')}
                className="peer h-11 w-full rounded-xl border border-input bg-background/60 px-3 py-2 pe-11 ps-10 text-sm shadow-sm ring-offset-background transition-all placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15"
                placeholder={t('passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center justify-center pe-3.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.password.message}
              </p>
            )}
          </motion.div>

          {/* Remember me */}
          <motion.label
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.13 }}
            htmlFor="remember"
            className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground"
          >
            <input
              id="remember"
              type="checkbox"
              {...register('remember')}
              className="h-4 w-4 cursor-pointer rounded border-input text-primary accent-primary focus:ring-2 focus:ring-primary/30 focus:ring-offset-0"
            />
            <span className="select-none">{t('rememberMe')}</span>
          </motion.label>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.18, ease }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ transitionDelay: '0.18s' }}
            className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-[hsl(231_75%_45%)] px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {/* Shimmer effect on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                {t('submitting')}
              </>
            ) : (
              <>
                {t('submit')}
                <ArrowRight className="h-4 w-4 rtl-flip transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </motion.button>
        </form>

        {/* Divider + secondary action */}
        <div className="mt-6 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>{t('needHelp')}</span>
          <a
            href="mailto:support@tms-logistique.ma"
            className="font-medium text-primary transition-colors hover:underline"
          >
            {t('contactSupport')}
          </a>
        </div>
      </div>

      {/* Trust footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="mt-5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          {t('secureLogin')}
        </span>
        <span className="h-3 w-px bg-border" />
        <span>{t('isoCompliance')}</span>
      </motion.div>
    </motion.div>
  )
}
