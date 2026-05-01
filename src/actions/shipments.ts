'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { calculatePrice, isUrgentDelivery } from '@/lib/pricing/calculator'
import { getRoute } from '@/lib/mapbox/geocoding'
import type { ActionResult, PricingRates } from '@/types/app.types'
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

export async function createShipment(
  formData: CreateShipmentData,
): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }

  const parsed = CreateShipmentSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' }
  }

  const data = parsed.data
  const supabase = await createClient()

  // Resolve pricing: client contract first (may set base_fee/price_per_km/urgency_pct),
  // pricing_defaults supplies vat_rate (always tenant-wide).
  const today = new Date().toISOString().slice(0, 10)
  const { data: contractRaw } = await supabase
    .from('client_pricing_contracts')
    .select('id, base_fee, price_per_km, urgency_surcharge_pct, valid_from, valid_to, is_active')
    .eq('client_id', data.clientId)
    .eq('company_id', user.companyId)
    .eq('is_active', true)
    .lte('valid_from', today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: defaultsRaw } = await supabase
    .from('pricing_defaults')
    .select('base_fee, price_per_km, urgency_surcharge_pct, vat_rate')
    .eq('company_id', user.companyId)
    .maybeSingle()

  type ContractRow = {
    id: string
    base_fee: number
    price_per_km: number
    urgency_surcharge_pct: number
  } | null
  type DefaultsRow = {
    base_fee: number
    price_per_km: number
    urgency_surcharge_pct: number
    vat_rate: number
  } | null

  const contract = contractRaw as unknown as ContractRow
  const defaults = defaultsRaw as unknown as DefaultsRow

  const rates: PricingRates = {
    baseFee: Number(contract?.base_fee ?? defaults?.base_fee ?? 100),
    pricePerKm: Number(contract?.price_per_km ?? defaults?.price_per_km ?? 5),
    urgencySurchargePct: Number(
      contract?.urgency_surcharge_pct ?? defaults?.urgency_surcharge_pct ?? 50,
    ),
    vatRate: Number(defaults?.vat_rate ?? 20),
    contractId: contract?.id ?? null,
    source: contract ? 'contract' : 'default',
  }

  // Calculate distance via Mapbox.
  let distanceKm = 0
  const routeResult = await getRoute(
    [data.pickupLng, data.pickupLat],
    [data.deliveryLng, data.deliveryLat],
  )
  if (routeResult) {
    distanceKm = routeResult.distanceKm
  }

  const urgent = isUrgentDelivery(data.deliveryScheduledAt)
  const breakdown = calculatePrice(distanceKm, rates, urgent)

  // Generate reference via DB function.
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
    pickup_street: data.pickupAddress,
    pickup_city: data.pickupCity,
    pickup_lng: data.pickupLng,
    pickup_lat: data.pickupLat,
    delivery_street: data.deliveryAddress,
    delivery_city: data.deliveryCity,
    delivery_lng: data.deliveryLng,
    delivery_lat: data.deliveryLat,
    delivery_scheduled_at: data.deliveryScheduledAt ?? null,
    distance_km: distanceKm,
    weight_kg: data.weightKg ?? null,
    volume_m3: data.volumeM3 ?? null,
    description: data.notes ?? null,
    price_excl_tax: breakdown.priceExclTax,
    tax_amount: breakdown.taxAmount,
    price_incl_tax: breakdown.priceInclTax,
    pricing_snapshot: breakdown as never,
  }

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert(insert)
    .select('id, reference')
    .single()

  if (error || !shipment) return { data: null, error: error?.message ?? 'Insert failed' }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath('/[locale]/(dashboard)/dashboard', 'page')
  return { data: { id: shipment.id, reference: shipment.reference }, error: null }
}

export async function assignDriver(
  shipmentId: string,
  driverId: string,
): Promise<ActionResult<null>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shipments')
    .update({ assigned_driver_id: driverId, status: 'assigned' })
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .eq('status', 'created')

  if (error) return { data: null, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { data: null, error: null }
}

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['customs_clearance', 'delivered', 'failed'],
  customs_clearance: ['delivered', 'failed'],
  delivered: [],
  failed: ['assigned'],
  cancelled: [],
}

export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  notes?: string,
): Promise<ActionResult<null>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Unauthorized' }

  const supabase = await createClient()

  const { data: shipmentRaw } = await supabase
    .from('shipments')
    .select('status, company_id, assigned_driver_id, description')
    .eq('id', shipmentId)
    .single()

  type ShipmentRow = {
    status: ShipmentStatus
    company_id: string
    assigned_driver_id: string | null
    description: string | null
  }
  const shipment = shipmentRaw as unknown as ShipmentRow | null
  if (!shipment) return { data: null, error: 'Shipment not found' }

  // Drivers can only update their own shipments.
  if (user.role === 'driver') {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!driver || shipment.assigned_driver_id !== driver.id) {
      return { data: null, error: 'Unauthorized' }
    }
  }

  const allowed = VALID_TRANSITIONS[shipment.status] ?? []
  if (!allowed.includes(newStatus)) {
    return { data: null, error: `Cannot transition from ${shipment.status} to ${newStatus}` }
  }

  const update: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'picked_up') update.pickup_actual_at = new Date().toISOString()
  if (newStatus === 'delivered') update.delivery_actual_at = new Date().toISOString()
  if (notes) update.description = notes

  const { error } = await supabase
    .from('shipments')
    // Update is built dynamically from a narrow set of allowed fields; the
    // strict generated `TablesUpdate<'shipments'>` shape would refuse the
    // bag-style write — cast at this boundary only.
    .update(update as never)
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)

  if (error) return { data: null, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  revalidatePath('/[locale]/(driver)/my-shipments', 'page')
  return { data: null, error: null }
}

export async function cancelShipment(
  shipmentId: string,
  reason?: string,
): Promise<ActionResult<null>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId || !['super_admin', 'company_admin', 'dispatcher'].includes(user.role)) {
    return { data: null, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Append the cancellation reason to description (the schema has no
  // dedicated `cancellation_reason` column).
  const update: Record<string, unknown> = { status: 'cancelled' }
  if (reason) {
    const { data: shipmentRaw } = await supabase
      .from('shipments')
      .select('description')
      .eq('id', shipmentId)
      .eq('company_id', user.companyId)
      .maybeSingle()
    const existing = (shipmentRaw as { description: string | null } | null)?.description ?? null
    update.description = existing
      ? `${existing}\n\n[CANCELLED] ${reason}`
      : `[CANCELLED] ${reason}`
  }

  const { error } = await supabase
    .from('shipments')
    // Update is built dynamically from a narrow set of allowed fields; the
    // strict generated `TablesUpdate<'shipments'>` shape would refuse the
    // bag-style write — cast at this boundary only.
    .update(update as never)
    .eq('id', shipmentId)
    .eq('company_id', user.companyId)
    .in('status', ['created', 'assigned'])

  if (error) return { data: null, error: error.message }

  revalidatePath('/[locale]/(dashboard)/shipments', 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { data: null, error: null }
}
