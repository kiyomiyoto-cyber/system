'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { signIn } from '@/actions/auth'

const LoginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(6, 'Mot de passe requis'),
})
type LoginForm = z.infer<typeof LoginSchema>

const ROLE_REDIRECTS: Record<string, string> = {
  super_admin: '/dashboard',
  company_admin: '/dashboard',
  dispatcher: '/dashboard',
  driver: '/my-shipments',
  client: '/shipments',
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) })

  async function onSubmit(values: LoginForm) {
    const result = await signIn(values.email, values.password)

    if (result.error) {
      toast.error(result.error)
      return
    }

    const redirect = ROLE_REDIRECTS[result.data.role] ?? '/dashboard'
    router.push(`/${locale}${redirect}`)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{t('login')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="nom@entreprise.ma"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            {t('password')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pe-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {t('signingIn')}
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              {t('login')}
            </>
          )}
        </button>
      </form>
    </div>
  )
}
