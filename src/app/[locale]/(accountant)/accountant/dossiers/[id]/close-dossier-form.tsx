'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { closeDossierByAccountant } from '@/actions/monthly-dossiers'

interface CloseDossierFormProps {
  dossierId: string
  labels: {
    title: string
    subtitle: string
    notesLabel: string
    notesPlaceholder: string
    notesHint: string
    submit: string
    submitting: string
    confirm: string
  }
}

const MAX_NOTES = 2000

export function CloseDossierForm({ dossierId, labels }: CloseDossierFormProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirm(labels.confirm)) return
    startTransition(async () => {
      const result = await closeDossierByAccountant({
        dossierId,
        notes: notes.trim() === '' ? undefined : notes.trim(),
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(labels.submit)
        router.refresh()
      }
    })
  }

  const remaining = MAX_NOTES - notes.length

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-5 shadow-soft"
    >
      <div className="mb-4">
        <h2 className="text-base font-bold text-foreground">{labels.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</p>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">
          {labels.notesLabel}
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
          placeholder={labels.notesPlaceholder}
          rows={5}
          disabled={isPending}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm shadow-soft outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <span className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{labels.notesHint}</span>
          <span className="font-mono tabular-nums">{remaining}</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {isPending ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
