import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import {
  RecurringSchedulesView,
  type ScheduleViewModel,
  type ClientOption,
  type DriverOption,
  type VehicleOption,
} from './recurring-schedules-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface ScheduleRow {
  id: string
  client_id: string
  name: string
  is_active: boolean
  days_of_week: number[]
  pickup_time: string
  delivery_offset_minutes: number | null
  pickup_street: string
  pickup_city: string
  pickup_postal_code: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_contact_name: string | null
  pickup_contact_phone: string | null
  delivery_street: string
  delivery_city: string
  delivery_postal_code: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  delivery_contact_name: string | null
  delivery_contact_phone: string | null
  default_driver_id: string | null
  default_vehicle_id: string | null
  default_vehicle_type: 'motorcycle' | 'van' | 'truck' | 'pickup' | null
  valid_from: string
  valid_to: string | null
  notes: string | null
  last_generated_through: string | null
  last_generated_at: string | null
  last_generated_count: number | null
  client: { id: string; business_name: string } | null
}

export default async function RecurringSchedulesPage() {
  const [, locale, user] = await Promise.all([
    getTranslations('recurring'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [schedulesResult, clientsResult, driversResult, vehiclesResult] = await Promise.all([
    supabase
      .from('recurring_schedules')
      .select(
        'id, client_id, name, is_active, days_of_week, pickup_time, delivery_offset_minutes, pickup_street, pickup_city, pickup_postal_code, pickup_lat, pickup_lng, pickup_contact_name, pickup_contact_phone, delivery_street, delivery_city, delivery_postal_code, delivery_lat, delivery_lng, delivery_contact_name, delivery_contact_phone, default_driver_id, default_vehicle_id, default_vehicle_type, valid_from, valid_to, notes, last_generated_through, last_generated_at, last_generated_count, client:clients(id, business_name)',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('business_name', { ascending: true }),
    supabase
      .from('drivers')
      .select('id, full_name')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('vehicles')
      .select('id, plate_number')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('plate_number', { ascending: true }),
  ])

  const schedules = ((schedulesResult.data ?? []) as unknown as ScheduleRow[])
  const clients = ((clientsResult.data ?? []) as unknown as ClientOption[])
  const drivers = ((driversResult.data ?? []) as unknown as DriverOption[])
  const vehicles = ((vehiclesResult.data ?? []) as unknown as VehicleOption[])

  const scheduleVms: ScheduleViewModel[] = schedules.map((s) => ({
    id: s.id,
    clientId: s.client_id,
    clientName: s.client?.business_name ?? '—',
    name: s.name,
    isActive: s.is_active,
    daysOfWeek: s.days_of_week,
    pickupTime: s.pickup_time.slice(0, 5),
    deliveryOffsetMinutes: s.delivery_offset_minutes,
    pickupStreet: s.pickup_street,
    pickupCity: s.pickup_city,
    pickupPostalCode: s.pickup_postal_code,
    pickupLat: s.pickup_lat,
    pickupLng: s.pickup_lng,
    pickupContactName: s.pickup_contact_name,
    pickupContactPhone: s.pickup_contact_phone,
    deliveryStreet: s.delivery_street,
    deliveryCity: s.delivery_city,
    deliveryPostalCode: s.delivery_postal_code,
    deliveryLat: s.delivery_lat,
    deliveryLng: s.delivery_lng,
    deliveryContactName: s.delivery_contact_name,
    deliveryContactPhone: s.delivery_contact_phone,
    defaultDriverId: s.default_driver_id,
    defaultVehicleId: s.default_vehicle_id,
    defaultVehicleType: s.default_vehicle_type,
    validFrom: s.valid_from,
    validTo: s.valid_to,
    notes: s.notes,
    lastGeneratedThrough: s.last_generated_through,
    lastGeneratedAt: s.last_generated_at,
    lastGeneratedCount: s.last_generated_count,
  }))

  const canEdit = user.role !== 'comptable'

  return (
    <RecurringSchedulesView
      schedules={scheduleVms}
      clients={clients}
      drivers={drivers}
      vehicles={vehicles}
      canEdit={canEdit}
    />
  )
}
