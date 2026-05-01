'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Eye, Loader2 } from 'lucide-react'
import { clearViewAsRole, type ViewAsRole } from '@/actions/view-as'

interface ViewAsBannerProps {
  role: ViewAsRole
  locale: string
}

export function ViewAsBanner({ role, locale }: ViewAsBannerProps) {
  const t = useTranslations('viewAsBanner')
  const tRoles = useTranslations('settings.role')
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span className="flex min-w-0 items-center gap-2">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {t('label', { role: tRoles(role) })}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => clearViewAsRole(locale))}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white/60 px-2 py-1 font-semibold text-amber-900 transition-colors hover:bg-white focus-ring disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowLeft className="h-3.5 w-3.5 rtl-flip" />
        )}
        {t('back')}
      </button>
    </div>
  )
}
