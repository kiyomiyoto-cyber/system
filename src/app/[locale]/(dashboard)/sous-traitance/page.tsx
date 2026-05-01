import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Handshake } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { SubcontractingView, type SubcontractorVm, type MissionVm, type ShipmentOption } from './subcontracting-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface SubcontractorRow {
  id: string
  name: string
  legal_form: string | null
  ice: string | null
  rc_number: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  whatsapp_phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  vehicle_types: string[]
  service_areas: string[]
  capacity_kg: number | null
  rating: number | null
  bank_name: string | null
  bank_iban: string | null
  payment_terms_days: number
  notes: string | null
  is_active: boolean
}

interface MissionRow {
  id: string
  mission_order_number: string
  cost_excl_tax: number | string
  sale_excl_tax: number | string
  margin_excl_tax: number | string
  margin_pct: number | string
  status: string
  sent_at: string | null
  sent_via: string | null
  sent_to: string | null
  mission_order_pdf_path: string | null
  notes: string | null
  internal_notes: string | null
  created_at: string
  subcontractor: { id: string; name: string } | null
  shipment: {
    id: string
    reference: string
    pickup_city: string
    delivery_city: string
    client: { id: string; business_name: string } | null
  } | null
}

interface ShipmentRow {
  id: string
  reference: string
  pickup_city: string
  delivery_city: string
  status: string
  price_excl_tax: number | string | null
  client: { business_name: string } | null
}

export default async function SubcontractingPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('subcontracting'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [subResult, missionResult, shipmentsResult] = await Promise.all([
    supabase
      .from('subcontractors')
      .select(
        'id, name, legal_form, ice, rc_number, contact_name, contact_phone, contact_email, whatsapp_phone, address, city, postal_code, vehicle_types, service_areas, capacity_kg, rating, bank_name, bank_iban, payment_terms_days, notes, is_active',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('subcontracted_missions')
      .select(
        'id, mission_order_number, cost_excl_tax, sale_excl_tax, margin_excl_tax, margin_pct, status, sent_at, sent_via, sent_to, mission_order_pdf_path, notes, internal_notes, created_at, subcontractor:subcontractors(id, name), shipment:shipments(id, reference, pickup_city, delivery_city, client:clients(id, business_name))',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    // Available shipments for new subcontracting:
    //   - belong to tenant
    //   - not yet subcontracted
    //   - status is pre-completion (created/assigned)
    supabase
      .from('shipments')
      .select(
        'id, reference, pickup_city, delivery_city, status, price_excl_tax, client:clients(business_name), subcontracted_mission_id',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .is('subcontracted_mission_id', null)
      .in('status', ['created', 'assigned'])
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const subs = ((subResult.data ?? []) as unknown as SubcontractorRow[])
  const missions = ((missionResult.data ?? []) as unknown as MissionRow[])
  const availableShipments = ((shipmentsResult.data ?? []) as unknown as ShipmentRow[])

  const subVms: SubcontractorVm[] = subs.map((s) => ({
    id: s.id,
    name: s.name,
    legalForm: s.legal_form,
    ice: s.ice,
    rcNumber: s.rc_number,
    contactName: s.contact_name,
    contactPhone: s.contact_phone,
    contactEmail: s.contact_email,
    whatsappPhone: s.whatsapp_phone,
    address: s.address,
    city: s.city,
    postalCode: s.postal_code,
    vehicleTypes: (s.vehicle_types ?? []) as Array<'motorcycle' | 'van' | 'truck' | 'pickup'>,
    serviceAreas: s.service_areas ?? [],
    capacityKg: s.capacity_kg,
    rating: s.rating,
    bankName: s.bank_name,
    bankIban: s.bank_iban,
    paymentTermsDays: s.payment_terms_days,
    notes: s.notes,
    isActive: s.is_active,
  }))

  const missionVms: MissionVm[] = missions.map((m) => ({
    id: m.id,
    missionOrderNumber: m.mission_order_number,
    costExclTax: Number(m.cost_excl_tax),
    saleExclTax: Number(m.sale_excl_tax),
    marginExclTax: Number(m.margin_excl_tax),
    marginPct: Number(m.margin_pct),
    status: m.status as MissionVm['status'],
    sentAt: m.sent_at,
    sentVia: m.sent_via,
    sentTo: m.sent_to,
    hasPdf: !!m.mission_order_pdf_path,
    notes: m.notes,
    internalNotes: m.internal_notes,
    createdAt: m.created_at,
    subcontractorId: m.subcontractor?.id ?? '',
    subcontractorName: m.subcontractor?.name ?? '—',
    shipmentId: m.shipment?.id ?? '',
    shipmentReference: m.shipment?.reference ?? '—',
    pickupCity: m.shipment?.pickup_city ?? '—',
    deliveryCity: m.shipment?.delivery_city ?? '—',
    clientName: m.shipment?.client?.business_name ?? '—',
  }))

  const shipmentOptions: ShipmentOption[] = availableShipments.map((s) => ({
    id: s.id,
    reference: s.reference,
    pickupCity: s.pickup_city,
    deliveryCity: s.delivery_city,
    clientName: s.client?.business_name ?? '—',
    priceExclTax: s.price_excl_tax == null ? null : Number(s.price_excl_tax),
  }))

  const canEdit = user.role === 'super_admin' || user.role === 'company_admin' || user.role === 'dispatcher'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <Handshake className="h-3.5 w-3.5" />
            {t('page.partnerCount', { count: subVms.filter((s) => s.isActive).length })}
          </span>
        }
      />

      <SubcontractingView
        subcontractors={subVms}
        missions={missionVms}
        availableShipments={shipmentOptions}
        canEdit={canEdit}
      />
    </div>
  )
}
