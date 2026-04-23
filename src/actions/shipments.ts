'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { calculatePrice, isUrgentDelivery } from '@/lib/pricing/calculator'
import { getRoute } from '@/lib/mapbox/geocoding'
import type { ActionResult } from '@/types/app.types'
import type { TablesInsert, ShipmentStatus } from '@/types/database.types'

const CreateShipmentSchema = z.object({
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

export type CreateShipmentData = z.infer<typeof CreateShipmentSchema>

export async function createShipment(formData: CreateShipmentData): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = CreateShipmentSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const data = parsed.data
  const supabase = await createClient()

  // Fetch pricing rates — check client contract first, fallback to defaults
  const { data: contract } = await supabase
    .from('client_pricing_contracts')
    .select('*')
    .eq('client_id', data.clientId)
    .eq('company_id', user.companyId)
    .lte('effective_from', new Date().toISOString())
    .or(`effective_until.is.null,effective_until.gte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: defaults } = await supabase
    .from('pricing_defaults')
    .select('*')
    .eq('company_id', user.companyId)
    .single()

  const rates = {
    baseFee: contract?.base_fee ?? defaults?.base_fee ?? 100,
    pricePerKm: contract?.price_per_km ?? defaults?.price_per_km ?? 5,
    urgencySurchargePct: contract?.urgency_surcharge_pct ?? defaults?.urgency_surcharge_pct ?? 50,
    vatRatePct: contract?.vat_rate_pct ?? defaults?.vat_rate_pct ?? 20,
    paymentTermsDays: contract?.payment_terms_days ?? defaults?.payment_terms_days ?? 30,
  }

  // Calculate distance via Mapbox
  let distanceKm = 0
  let routeGeometry: Record<string, unknown> | null = null
  const routeResult = await getRoute(
    [data.pickupLng, data.pickupLat],
    [data.deliveryLng, data.deliveryLat]
  )
  if (routeResult) {
    distanceKm = routeResult.distanceKm
    routeGeometry = routeResult.geometry as Record<string, unknown>
  }

  const urgent = isUrgentDelivery(data.deliveryScheduledAt)
  const breakdown = calculatePrice(distanceKm, rates, urgent)

  // Generate reference via DB function
  const { data: seqData } = await supabase.rpc('next_sequence_value', {
    p_company_id: user.companyId,
    p_type: 'shipment',
  })
  const reference = `EXP-${new Date().getFullYear()}-${String(seqData ?? 1).padStart(4, '0')}`

  const insert: TablesInsert<'shipments'> = {
    company_id: user.companyId,
    reference,
    client_id: data.clientId,
    created_by: user.id,
    status: 'created',
    pickup_address: data.pickupAddress,
    pickup_city: data.pickupCity,
    pickup_lng: data.pickupLng,
    pickup_lat: data.pickupLat,
    delivery_address: data.deliveryAddress,
    delivery_city: data.deliveryCity,
    delivery_lng: data.deliveryLng,
    delivery_lat: data.deliveryLat,
    delivery_scheduled_at: data.deliveryScheduledAt ?? null,
    distance_km: distanceKm,
    weight_kg: data.weightKg ?? null,
    volume_m3: data.volumeM3 ?? null,
    notes: data.notes ?? null,
    price_excl_tax: breakdown.priceExclTax,
    vat_amount: breakdown.vatAmount,
    total_price: breakdown.totalPrice,
    pricing_snapshot: breakdown as unknown as Record<string, unknown>,
    route_geometry: routeGeometry,
  }

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert(insert)
    .select('id, reference')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath('/[locale]/(dashboard)/dashboard', 'page')
  return { success: true, data: { id: shipment.id, reference: shipment.reference } }
}

export async function assignDriver(
  shipmentId: string,
  driverId: string
): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shipments')
    .update({ driver_id: driverId, status: 'assigned' })
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .eq('status', 'created')

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { success: true, data: undefined }
}

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: ['assigned'],
  cancelled: [],
}

export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  notes?: string
): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const supabase = await createClient()

  const { data: shipment } = await supabase
    .from('shipments')
    .select('status, company_id, driver_id')
    .eq('id', shipmentId)
    .single()

  if (!shipment) return { success: false, error: 'Shipment not found' }

  // Drivers can only update their own shipments
  if (user.role === 'driver') {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!driver || shipment.driver_id !== driver.id) {
      return { success: false, error: 'Unauthorized' }
    }
  }

  const allowed = VALID_TRANSITIONS[shipment.status as ShipmentStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return { success: false, error: `Cannot transition from ${shipment.status} to ${newStatus}` }
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'picked_up') updateData.picked_up_at = new Date().toISOString()
  if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString()
  if (notes) updateData.notes = notes

  const { error } = await supabase
    .from('shipments')
    .update(updateData)
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  revalidatePath('/[locale]/(driver)/my-shipments', 'page')
  return { success: true, data: undefined }
}

export async function cancelShipment(shipmentId: string, reason?: string): Promise<ActionResult<void>> {
  const user = await getAuthenticatedUser()
  if (!user || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shipments')
    .update({
      status: 'cancelled',
      cancellation_reason: reason ?? null,
    })
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .in('status', ['created', 'assigned'])

  if (error) return { success: false, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { success: true, data: undefined }
}
