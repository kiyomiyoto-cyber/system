'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createDriver, updateDriver, type DriverFormData } from '@/actions/drivers'
import type { Tables } from '@/types/database.types'

const Schema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  licenseNumber: z.string().min(3),
  licenseExpiry: z.string().optional(),
  cin: z.string().optional(),
  notes: z.string().optional(),
})

interface DriverFormProps {
  driver?: Tables<'drivers'>
}

export function DriverForm({ driver }: DriverFormProps) {
  const t = useTranslations('drivers')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<DriverFormData>({
    resolver: zodResolver(Schema),
    defaultValues: driver
      ? {
          fullName: driver.full_name,
          phone: driver.phone,
          email: driver.email ?? '',
          licenseNumber: driver.license_number ?? '',
          licenseExpiry: driver.license_expiry ?? '',
          cin: driver.cin ?? '',
          notes: driver.notes ?? '',
        }
      : { fullName: '', phone: '', email: '', licenseNumber: '', licenseExpiry: '', cin: '', notes: '' },
  })

  async function onSubmit(data: DriverFormData) {
    setSubmitting(true)
    const result = driver ? await updateDriver(driver.id, data) : await createDriver(data)

    if (result.success) {
      toast.success(driver ? t('updated') : t('created'))
      router.push(`/${locale}/drivers`)
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
          <label className={labelClass}>{t('fullName')} *</label>
          <input className={inputClass} {...form.register('fullName')} />
          {form.formState.errors.fullName && <p className={errorClass}>{form.formState.errors.fullName.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('phone')} *</label>
          <input className={inputClass} {...form.register('phone')} placeholder="+212600000000" />
          {form.formState.errors.phone && <p className={errorClass}>{form.formState.errors.phone.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('email')}</label>
          <input className={inputClass} type="email" {...form.register('email')} />
        </div>

        <div>
          <label className={labelClass}>{t('cin')}</label>
          <input className={inputClass} {...form.register('cin')} />
        </div>

        <div>
          <label className={labelClass}>{t('licenseNumber')} *</label>
          <input className={inputClass} {...form.register('licenseNumber')} />
          {form.formState.errors.licenseNumber && <p className={errorClass}>{form.formState.errors.licenseNumber.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('licenseExpiry')}</label>
          <input className={inputClass} type="date" {...form.register('licenseExpiry')} />
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
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {driver ? tCommon('save') : tCommon('create')}
        </button>
      </div>
    </form>
  )
}
