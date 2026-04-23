'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Package, MapPin, Calculator, AlertCircle } from 'lucide-react'
import { createShipment, type CreateShipmentData } from '@/actions/shipments'
import { GeocoderInput } from '@/components/maps/geocoder-input'
import { createClient } from '@/lib/supabase/client'
import { calculatePrice, isUrgentDelivery } from '@/lib/pricing/calculator'
import { formatMAD, formatDistance } from '@/lib/utils/formatters'
import type { GeocodingResult, PricingRates, PriceBreakdown } from '@/types/app.types'

const Schema = z.object({
  clientId: z.string().uuid(),
  pickupAddress: z.string().min(3),
  pickupCity: z.string().min(2),
  pickupLng: z.number(),
  pickupLat: z.number(),
  deliveryAddress: z.string().min(3),
  deliveryCity: z.string().min(2),
  deliveryLng: z.number(),
  deliveryLat: z.number(),
  deliveryScheduledAt: z.string().optional(),
  weightKg: z.coerce.number().min(0).optional(),
  volumeM3: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})

interface ShipmentFormProps {
  companyId: string
}

export function ShipmentForm({ companyId }: ShipmentFormProps) {
  const t = useTranslations('shipments')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([])
  const [rates, setRates] = useState<PricingRates | null>(null)
  const [estimate, setEstimate] = useState<PriceBreakdown | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  const form = useForm<CreateShipmentData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      clientId: '',
      pickupAddress: '',
      pickupCity: '',
      pickupLng: 0,
      pickupLat: 0,
      deliveryAddress: '',
      deliveryCity: '',
      deliveryLng: 0,
      deliveryLat: 0,
      deliveryScheduledAt: '',
      notes: '',
    },
  })

  const { watch, setValue, control } = form

  // Load clients + pricing
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('business_name')
      .then(({ data }) => setClients(data ?? []))

    supabase
      .from('pricing_defaults')
      .select('*')
      .eq('company_id', companyId)
      .single()
      .then(({ data }) => {
        if (data) {
          setRates({
            baseFee: data.base_fee,
            pricePerKm: data.price_per_km,
            urgencySurchargePct: data.urgency_surcharge_pct,
            vatRatePct: data.vat_rate_pct,
            paymentTermsDays: data.payment_terms_days,
          })
        }
      })
  }, [companyId])

  // Recompute on coordinates / scheduling change
  const pickupLng = watch('pickupLng')
  const pickupLat = watch('pickupLat')
  const deliveryLng = watch('deliveryLng')
  const deliveryLat = watch('deliveryLat')
  const scheduledAt = watch('deliveryScheduledAt')

  useEffect(() => {
    if (!pickupLng || !pickupLat || !deliveryLng || !deliveryLat || !rates) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    setCalculating(true)
    setRouteError(null)
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}?access_token=${token}&overview=false`
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        const route = json.routes?.[0]
        if (!route) {
          setRouteError(t('noRouteFound'))
          setEstimate(null)
          return
        }
        const km = route.distance / 1000
        const urgent = isUrgentDelivery(scheduledAt)
        setEstimate(calculatePrice(km, rates, urgent))
      })
      .catch(() => setRouteError(t('routeError')))
      .finally(() => setCalculating(false))
  }, [pickupLng, pickupLat, deliveryLng, deliveryLat, scheduledAt, rates, t])

  async function onSubmit(data: CreateShipmentData) {
    setSubmitting(true)
    const result = await createShipment(data)
    if (result.success) {
      toast.success(t('createdWithRef', { ref: result.data.reference }))
      router.push(`/${locale}/shipments/${result.data.id}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  function handlePickup(r: GeocodingResult) {
    setValue('pickupAddress', r.placeName)
    setValue('pickupCity', r.city)
    setValue('pickupLng', r.center[0])
    setValue('pickupLat', r.center[1])
  }

  function handleDelivery(r: GeocodingResult) {
    setValue('deliveryAddress', r.placeName)
    setValue('deliveryCity', r.city)
    setValue('deliveryLng', r.center[0])
    setValue('deliveryLat', r.center[1])
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'
  const urgent = isUrgentDelivery(scheduledAt)

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Client */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <Package className="h-4 w-4 text-primary" />
          {t('shipmentInfo')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>{t('client')} *</label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <select className={inputClass} {...field}>
                  <option value="">{t('selectClient')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.business_name}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div>
            <label className={labelClass}>{t('scheduledDelivery')}</label>
            <input className={inputClass} type="datetime-local" {...form.register('deliveryScheduledAt')} />
            {urgent && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('urgentSurchargeApplies')}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>{t('weightKg')}</label>
              <input className={inputClass} type="number" step="0.1" {...form.register('weightKg')} />
            </div>
            <div>
              <label className={labelClass}>{t('volumeM3')}</label>
              <input className={inputClass} type="number" step="0.01" {...form.register('volumeM3')} />
            </div>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {t('route')}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <GeocoderInput
            label={t('pickupLocation')}
            placeholder={t('pickupPlaceholder')}
            value={watch('pickupAddress')}
            onSelect={handlePickup}
            required
          />
          <GeocoderInput
            label={t('deliveryLocation')}
            placeholder={t('deliveryPlaceholder')}
            value={watch('deliveryAddress')}
            onSelect={handleDelivery}
            required
          />
        </div>
        <div className="mt-4">
          <label className={labelClass}>{t('notes')}</label>
          <textarea className={inputClass} rows={2} {...form.register('notes')} />
        </div>
      </section>

      {/* Price estimate */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <Calculator className="h-4 w-4 text-primary" />
          {t('priceEstimate')}
        </h2>
        {calculating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('calculatingPrice')}
          </div>
        ) : routeError ? (
          <p className="text-sm text-destructive">{routeError}</p>
        ) : estimate ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('distance')}</dt><dd className="font-medium">{formatDistance(estimate.distanceKm)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('baseFee')}</dt><dd className="font-medium">{formatMAD(estimate.baseFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('distanceFee')}</dt><dd className="font-medium">{formatMAD(estimate.distanceFee)}</dd></div>
            {estimate.urgencySurcharge > 0 && (
              <div className="flex justify-between text-amber-700"><dt>{t('urgencySurcharge')}</dt><dd className="font-medium">{formatMAD(estimate.urgencySurcharge)}</dd></div>
            )}
            <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground">{t('subtotal')}</dt><dd className="font-medium">{formatMAD(estimate.priceExclTax)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('vat')}</dt><dd className="font-medium">{formatMAD(estimate.vatAmount)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base"><dt className="font-semibold">{t('total')}</dt><dd className="font-bold text-primary">{formatMAD(estimate.totalPrice)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('selectAddressesToCalculate')}</p>
        )}
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || !estimate}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('createShipment')}
        </button>
      </div>
    </form>
  )
}
