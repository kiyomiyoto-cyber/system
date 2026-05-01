'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, X, Plus } from 'lucide-react'
import { recordPayment } from '@/actions/invoices'
import { formatMAD } from '@/lib/utils/formatters'

const Schema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'check']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof Schema>

interface Props {
  invoiceId: string
  balance: number
}

export function RecordPaymentDialog({ invoiceId, balance }: Props) {
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      amount: balance,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      reference: '',
      notes: '',
    },
  })

  async function onSubmit(data: FormData) {
    setSubmitting(true)
    const result = await recordPayment(invoiceId, data)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('paymentRecorded'))
      setOpen(false)
      router.refresh()
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {t('recordPayment')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{t('recordPayment')}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{t('outstandingBalance')}: <strong className="text-foreground">{formatMAD(balance)}</strong></p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className={labelClass}>{t('amount')} (MAD) *</label>
                <input className={inputClass} type="number" step="0.01" {...form.register('amount')} />
              </div>
              <div>
                <label className={labelClass}>{t('paymentDate')} *</label>
                <input className={inputClass} type="date" {...form.register('paymentDate')} />
              </div>
              <div>
                <label className={labelClass}>{t('paymentMethod')} *</label>
                <select className={inputClass} {...form.register('paymentMethod')}>
                  <option value="bank_transfer">{t('paymentMethod.bank_transfer')}</option>
                  <option value="cash">{t('paymentMethod.cash')}</option>
                  <option value="check">{t('paymentMethod.check')}</option>
                  <option value="other">{t('paymentMethod.other')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('reference')}</label>
                <input className={inputClass} {...form.register('reference')} placeholder={t('referencePlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('notes')}</label>
                <textarea className={inputClass} rows={2} {...form.register('notes')} />
              </div>

              <div className="flex gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tCommon('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
