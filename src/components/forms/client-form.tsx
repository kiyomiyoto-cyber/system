'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient_action, updateClient, type ClientFormData } from '@/actions/clients'
import type { Tables } from '@/types/database.types'

const Schema = z.object({
  businessName: z.string().min(2),
  ice: z.string().optional(),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().min(2),
  billingMode: z.enum(['per_shipment', 'monthly_grouped']),
  paymentTermsDays: z.coerce.number().int().min(0).max(90),
  notes: z.string().optional(),
})

interface ClientFormProps {
  client?: Tables<'clients'>
}

export function ClientForm({ client }: ClientFormProps) {
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(Schema),
    defaultValues: client
      ? {
          businessName: client.business_name,
          ice: client.ice ?? '',
          phone: client.phone,
          email: client.email ?? '',
          address: client.address ?? '',
          city: client.city,
          billingMode: client.billing_mode,
          paymentTermsDays: client.payment_terms_days,
          notes: client.notes ?? '',
        }
      : {
          businessName: '',
          ice: '',
          phone: '',
          email: '',
          address: '',
          city: '',
          billingMode: 'per_shipment',
          paymentTermsDays: 30,
          notes: '',
        },
  })

  async function onSubmit(data: ClientFormData) {
    setSubmitting(true)
    const result = client
      ? await updateClient(client.id, data)
      : await createClient_action(data)

    if (result.success) {
      toast.success(client ? t('updated') : t('created'))
      router.push(`/${locale}/clients`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'
  const errorClass = 'mt-1 text-xs text-destructive'

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('businessName')} *</label>
          <input className={inputClass} {...form.register('businessName')} />
          {form.formState.errors.businessName && <p className={errorClass}>{form.formState.errors.businessName.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('ice')}</label>
          <input className={inputClass} {...form.register('ice')} placeholder="001234567000001" />
        </div>

        <div>
          <label className={labelClass}>{t('phone')} *</label>
          <input className={inputClass} {...form.register('phone')} placeholder="+212522000000" />
          {form.formState.errors.phone && <p className={errorClass}>{form.formState.errors.phone.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('email')}</label>
          <input className={inputClass} type="email" {...form.register('email')} />
          {form.formState.errors.email && <p className={errorClass}>{form.formState.errors.email.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('city')} *</label>
          <input className={inputClass} {...form.register('city')} />
          {form.formState.errors.city && <p className={errorClass}>{form.formState.errors.city.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t('address')}</label>
          <input className={inputClass} {...form.register('address')} />
        </div>

        <div>
          <label className={labelClass}>{t('billingMode')} *</label>
          <select className={inputClass} {...form.register('billingMode')}>
            <option value="per_shipment">{t('perShipment')}</option>
            <option value="monthly_grouped">{t('monthlyGrouped')}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('paymentTermsDays')} *</label>
          <select className={inputClass} {...form.register('paymentTermsDays')}>
            <option value="0">{t('immediate')}</option>
            <option value="15">15 {tCommon('days')}</option>
            <option value="30">30 {tCommon('days')}</option>
            <option value="60">60 {tCommon('days')}</option>
            <option value="90">90 {tCommon('days')}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t('notes')}</label>
          <textarea className={inputClass} rows={3} {...form.register('notes')} />
        </div>
      </div>

      <div className="flex gap-3 border-t pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {client ? tCommon('save') : tCommon('create')}
        </button>
      </div>
    </form>
  )
}
