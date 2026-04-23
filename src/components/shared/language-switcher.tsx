'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(next: 'fr' | 'ar') {
    if (next === locale) return
    // Replace the locale segment in the current path
    const segments = pathname.split('/')
    segments[1] = next
    router.push(segments.join('/'))
    router.refresh()
  }

  return (
    <div className={cn('flex items-center gap-1 rounded-lg border p-1', className)}>
      <button
        onClick={() => switchLocale('fr')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          locale === 'fr'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Passer en français"
      >
        FR
      </button>
      <button
        onClick={() => switchLocale('ar')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          locale === 'ar'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="التبديل إلى العربية"
      >
        ع
      </button>
    </div>
  )
}
