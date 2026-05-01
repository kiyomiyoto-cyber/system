'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { sendDossierByEmail } from '@/actions/monthly-dossiers'

interface SendDossierButtonProps {
  dossierId: string
  accountantEmail: string
  alreadySent: boolean
  labelSend: string
  labelResend: string
  confirmResend: string
}

export function SendDossierButton({
  dossierId,
  alreadySent,
  labelSend,
  labelResend,
  confirmResend,
}: SendDossierButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (alreadySent && !confirm(confirmResend)) return
    startTransition(async () => {
      const result = await sendDossierByEmail(dossierId)
      if (result.error) toast.error(result.error)
      else {
        toast.success(`Envoyé à ${result.data?.sentTo}`)
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {alreadySent ? labelResend : labelSend}
    </button>
  )
}
