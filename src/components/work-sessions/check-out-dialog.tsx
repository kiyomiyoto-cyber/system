'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, X, LogOut } from 'lucide-react'
import { useCheckOut } from '@/hooks/use-work-sessions'
import { StarRating } from './star-rating'

interface CheckOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}

export function CheckOutDialog({ open, onOpenChange, sessionId }: CheckOutDialogProps) {
  const t = useTranslations('workSessions')
  const tCommon = useTranslations('common')
  const checkOut = useCheckOut()

  const [prod, setProd] = useState(0)
  const [motiv, setMotiv] = useState(0)
  const [blockers, setBlockers] = useState('')
  const [notes, setNotes] = useState('')

  const reset = () => {
    setProd(0)
    setMotiv(0)
    setBlockers('')
    setNotes('')
  }

  if (!open) return null

  const canSubmit = prod > 0 && motiv > 0 && !checkOut.isPending

  const onSubmit = async () => {
    try {
      await checkOut.mutateAsync({
        sessionId,
        prodRating: prod,
        motivRating: motiv,
        blockers: blockers.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success(t('checkOut.toastSuccess'), {
        description: t('checkOut.toastSuccessDescription'),
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('checkOut.toastError')
      toast.error(t('checkOut.toastError'), { description: message })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => !checkOut.isPending && onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b bg-gradient-to-br from-primary/5 to-primary/0 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{t('checkOut.title')}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t('checkOut.subtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !checkOut.isPending && onOpenChange(false)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
              aria-label={tCommon('cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              {t('checkOut.productivity')}
            </label>
            <StarRating value={prod} onChange={setProd} size={26} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              {t('checkOut.motivation')}
            </label>
            <StarRating value={motiv} onChange={setMotiv} size={26} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              {t('checkOut.blockers')}
            </label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder={t('checkOut.blockersPlaceholder')}
              rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              {t('checkOut.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t bg-muted/30 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={checkOut.isPending}
            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-ring disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-ring disabled:opacity-50"
          >
            {checkOut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {checkOut.isPending ? t('checkOut.submitting') : t('checkOut.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
