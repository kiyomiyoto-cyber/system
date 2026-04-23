'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Info } from 'lucide-react'
import { updatePricingDefaults, type PricingDefaultsForm as FormData } from '@/actions/pricing'
import type { Tables } from '@/types/database.types'

const Schema = z.object({
  baseFee: z.coerce.number().min(0),
  pricePerKm: z.coerce.number().min(0),
  urgencySurchargePct: z.coerce.number().min(0).max(200),
  vatRatePct: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(180),
})

interface Props {
  defaults: Tables<'pricing_defaults'> | null
}

export function PricingDefaultsForm({ defaults }: Props) {
  const t = useTranslations('pricing')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      baseFee: defaults?.base_fee ?? 100,
      pricePerKm: defaults?.price_per_km ?? 5,
      urgencySurchargePct: defaults?.urgency_surcharge_pct ?? 50,
      vatRatePct: defaults?.vat_rate_pct ?? 20,
      paymentTermsDays: defaults?.payment_terms_days ?? 30,
    },
  })

  async function onSubmit(data: FormData) {
    setSubmitting(true)
    const result = await updatePricingDefaults(data)
    if (result.success) {
      toast.success(t('saved'))
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 flex gap-3">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('formulaTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed">{t('formulaExplanation')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('baseFee')} (MAD)</label>
          <input className={inputClass} type="number" step="0.01" {...form.register('baseFee')} />
        </div>
        <div>
          <label className={labelClass}>{t('pricePerKm')} (MAD/km)</label>
          <input className={inputClass} type="number" step="0.01" {...form.register('pricePerKm')} />
        </div>
        <div>
          <label className={labelClass}>{t('urgencySurcharge')} (%)</label>
          <input className={inputClass} type="number" step="0.1" {...form.register('urgencySurchargePct')} />
          <p className="mt-1 text-xs text-muted-foreground">{t('urgencyHelp')}</p>
        </div>
        <div>
          <label className={labelClass}>{t('vatRate')} (%)</label>
          <input className={inputClass} type="number" step="0.1" {...form.register('vatRatePct')} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('paymentTerms')} ({tCommon('days')})</label>
          <select className={inputClass} {...form.register('paymentTermsDays')}>
            <option value="0">{t('immediate')}</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="90">90</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end border-t pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </button>
      </div>
    </form>
  )
}
