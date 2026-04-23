'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createVehicle, updateVehicle, type VehicleFormData } from '@/actions/vehicles'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'

const Schema = z.object({
  plateNumber: z.string().min(2),
  type: z.enum(['van', 'truck', 'motorcycle', 'car', 'semi_truck']),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  color: z.string().optional(),
  capacityKg: z.coerce.number().min(0).optional(),
  capacityM3: z.coerce.number().min(0).optional(),
  insuranceExpiry: z.string().optional(),
  technicalControlExpiry: z.string().optional(),
  driverId: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
})

interface VehicleFormProps {
  vehicle?: Tables<'vehicles'>
  companyId: string
}

export function VehicleForm({ vehicle, companyId }: VehicleFormProps) {
  const t = useTranslations('vehicles')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('drivers')
      .select('id, full_name')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('full_name')
      .then(({ data }) => setDrivers(data ?? []))
  }, [companyId])

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(Schema),
    defaultValues: vehicle
      ? {
          plateNumber: vehicle.plate_number,
          type: vehicle.type,
          brand: vehicle.brand ?? '',
          model: vehicle.model ?? '',
          year: vehicle.year ?? undefined,
          color: vehicle.color ?? '',
          capacityKg: vehicle.capacity_kg ?? undefined,
          capacityM3: vehicle.capacity_m3 ?? undefined,
          insuranceExpiry: vehicle.insurance_expiry ?? '',
          technicalControlExpiry: vehicle.technical_control_expiry ?? '',
          driverId: vehicle.driver_id ?? '',
          notes: vehicle.notes ?? '',
        }
      : {
          plateNumber: '',
          type: 'van',
          brand: '',
          model: '',
          color: '',
          insuranceExpiry: '',
          technicalControlExpiry: '',
          driverId: '',
          notes: '',
        },
  })

  async function onSubmit(data: VehicleFormData) {
    setSubmitting(true)
    const result = vehicle ? await updateVehicle(vehicle.id, data) : await createVehicle(data)

    if (result.success) {
      toast.success(vehicle ? t('updated') : t('created'))
      router.push(`/${locale}/vehicles`)
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('plateNumber')} *</label>
          <input className={inputClass} {...form.register('plateNumber')} placeholder="12345-A-1" />
        </div>

        <div>
          <label className={labelClass}>{t('type')} *</label>
          <select className={inputClass} {...form.register('type')}>
            <option value="van">{t('types.van')}</option>
            <option value="truck">{t('types.truck')}</option>
            <option value="semi_truck">{t('types.semi_truck')}</option>
            <option value="car">{t('types.car')}</option>
            <option value="motorcycle">{t('types.motorcycle')}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{t('brand')}</label>
          <input className={inputClass} {...form.register('brand')} />
        </div>

        <div>
          <label className={labelClass}>{t('model')}</label>
          <input className={inputClass} {...form.register('model')} />
        </div>

        <div>
          <label className={labelClass}>{t('year')}</label>
          <input className={inputClass} type="number" {...form.register('year')} />
        </div>

        <div>
          <label className={labelClass}>{t('color')}</label>
          <input className={inputClass} {...form.register('color')} />
        </div>

        <div>
          <label className={labelClass}>{t('capacityKg')}</label>
          <input className={inputClass} type="number" step="0.01" {...form.register('capacityKg')} />
        </div>

        <div>
          <label className={labelClass}>{t('capacityM3')}</label>
          <input className={inputClass} type="number" step="0.01" {...form.register('capacityM3')} />
        </div>

        <div>
          <label className={labelClass}>{t('insuranceExpiry')}</label>
          <input className={inputClass} type="date" {...form.register('insuranceExpiry')} />
        </div>

        <div>
          <label className={labelClass}>{t('technicalControlExpiry')}</label>
          <input className={inputClass} type="date" {...form.register('technicalControlExpiry')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t('assignedDriver')}</label>
          <select className={inputClass} {...form.register('driverId')}>
            <option value="">{t('noDriver')}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
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
          {vehicle ? tCommon('save') : tCommon('create')}
        </button>
      </div>
    </form>
  )
}
