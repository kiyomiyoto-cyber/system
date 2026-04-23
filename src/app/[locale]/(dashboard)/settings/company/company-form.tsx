'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { updateCompany, type CompanyFormData } from '@/actions/company'
import type { Tables } from '@/types/database.types'

const Schema = z.object({
  name: z.string().min(2),
  ice: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().min(2),
  country: z.string().default('MA'),
})

interface Props {
  company: Tables<'companies'>
}

export function CompanyForm({ company }: Props) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: company.name,
      ice: company.ice ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      address: company.address ?? '',
      city: company.city,
      country: company.country,
    },
  })

  async function onSubmit(data: CompanyFormData) {
    setSubmitting(true)
    const result = await updateCompany(data)
    if (result.success) {
      toast.success(t('companyUpdated'))
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('companyName')} *</label>
          <input className={inputClass} {...form.register('name')} />
        </div>
        <div>
          <label className={labelClass}>ICE</label>
          <input className={inputClass} {...form.register('ice')} />
        </div>
        <div>
          <label className={labelClass}>{t('phone')}</label>
          <input className={inputClass} {...form.register('phone')} />
        </div>
        <div>
          <label className={labelClass}>{tCommon('email')}</label>
          <input className={inputClass} type="email" {...form.register('email')} />
        </div>
        <div>
          <label className={labelClass}>{t('city')} *</label>
          <input className={inputClass} {...form.register('city')} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('address')}</label>
          <textarea className={inputClass} rows={2} {...form.register('address')} />
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
