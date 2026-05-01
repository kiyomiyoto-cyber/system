'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { markTaxAsDeclared } from '@/actions/tax-declarations'
import { formatMAD } from '@/lib/utils/formatters'

interface MarkDeclaredFormProps {
  period: string
  amountDue: number
  supportingDocumentIds?: string[]
  computedSnapshot: Record<string, unknown>
  declarationType?: 'vat' | 'ir' | 'cnss'
  title?: string
  subtitle?: string
}

export function MarkDeclaredForm({
  period,
  amountDue,
  supportingDocumentIds,
  computedSnapshot,
  declarationType = 'vat',
  title,
  subtitle,
}: MarkDeclaredFormProps) {
  const t = useTranslations('accounting')
  const router = useRouter()

  const todayIso = new Date().toISOString().slice(0, 10)
  const [reference, setReference] = useState('')
  const [declarationDate, setDeclarationDate] = useState(todayIso)
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (reference.trim().length < 1) {
      toast.error(t('tva.refRequired'))
      return
    }
    startTransition(async () => {
      const result = await markTaxAsDeclared({
        periodMonth: period,
        declarationType,
        declarationReference: reference.trim(),
        declarationDate,
        amountDue,
        amountPaid: amountPaid === '' ? null : Number(amountPaid),
        paymentDate: paymentDate || null,
        notes: notes.trim() || null,
        computedSnapshot,
        supportingDocumentIds,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('tva.declared'))
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">{title ?? t('tva.markDeclared')}</h2>
        <p className="text-xs text-muted-foreground">
          {subtitle ?? t('tva.markDeclaredSubtitle', { amount: formatMAD(amountDue) })}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('tva.declarationRef')} *
          </label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="DGI-..."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('tva.declarationDate')} *
          </label>
          <input
            type="date"
            value={declarationDate}
            onChange={(e) => setDeclarationDate(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('tva.amountPaid')}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('tva.paymentDate')}
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('tva.notes')}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {t('tva.markDeclared')}
        </button>
      </div>
    </form>
  )
}
