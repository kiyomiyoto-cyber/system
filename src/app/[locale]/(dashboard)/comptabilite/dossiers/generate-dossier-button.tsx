'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { generateMonthlyDossier } from '@/actions/monthly-dossiers'

interface GenerateDossierButtonProps {
  period: string
  label: string
  variant?: 'primary' | 'secondary'
}

export function GenerateDossierButton({ period, label, variant = 'primary' }: GenerateDossierButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await generateMonthlyDossier(period)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Dossier généré')
        if (result.data?.dossierId) {
          router.push(`./dossiers/${result.data.dossierId}`)
        } else {
          router.refresh()
        }
      }
    })
  }

  const className =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50'

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {label}
    </button>
  )
}
