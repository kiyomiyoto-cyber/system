import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Globe2 } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import {
  FreeZonesView,
  type ZoneVm,
  type DocumentTypeVm,
  type ZoneShipmentVm,
} from './free-zones-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface ZoneRow {
  id: string
  code: string
  name: string
  city: string
  country: string
  customs_office_code: string | null
  notes: string | null
  is_active: boolean
}

interface DocTypeRow {
  id: string
  code: string
  name: string
  description: string | null
  applicable_to: 'import' | 'export' | 'both'
  required_by_default: boolean
  sort_order: number
  is_active: boolean
}

interface MatrixRow {
  free_zone_id: string
  document_type_id: string
  is_required: boolean
}

interface ShipmentRow {
  id: string
  reference: string
  status: string
  pickup_city: string
  delivery_city: string
  pickup_free_zone_id: string | null
  delivery_free_zone_id: string | null
  delivery_scheduled_at: string | null
  client: { business_name: string } | null
}

interface ComplianceRow {
  shipment_id: string
  required_count: number
  uploaded_count: number
  compliance_status: 'no_requirement' | 'complete' | 'missing' | 'partial'
}

interface UploadedDocRow {
  id: string
  shipment_id: string
  document_type_id: string
  document_number: string | null
  document_date: string | null
  file_name: string
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export default async function FreeZonesPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('freeZones'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [zonesRes, docTypesRes, matrixRes, shipmentsRes, complianceRes, uploadedRes] =
    await Promise.all([
      supabase
        .from('free_zones')
        .select('id, code, name, city, country, customs_office_code, notes, is_active')
        .eq('company_id', user.companyId)
        .is('deleted_at', null)
        .order('is_active', { ascending: false })
        .order('code', { ascending: true }),
      supabase
        .from('customs_document_types')
        .select('id, code, name, description, applicable_to, required_by_default, sort_order, is_active')
        .eq('company_id', user.companyId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true }),
      supabase
        .from('free_zone_required_documents')
        .select('free_zone_id, document_type_id, is_required')
        .eq('company_id', user.companyId),
      // Active shipments touching at least one free zone
      supabase
        .from('shipments')
        .select(
          'id, reference, status, pickup_city, delivery_city, pickup_free_zone_id, delivery_free_zone_id, delivery_scheduled_at, client:clients(business_name)',
        )
        .eq('company_id', user.companyId)
        .is('deleted_at', null)
        .or('pickup_free_zone_id.not.is.null,delivery_free_zone_id.not.is.null')
        .order('delivery_scheduled_at', { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from('v_shipment_customs_compliance')
        .select('shipment_id, required_count, uploaded_count, compliance_status')
        .eq('company_id', user.companyId),
      supabase
        .from('shipment_customs_documents')
        .select(
          'id, shipment_id, document_type_id, document_number, document_date, file_name, mime_type, file_size_bytes, created_at',
        )
        .eq('company_id', user.companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

  const zones = ((zonesRes.data ?? []) as unknown as ZoneRow[])
  const docTypes = ((docTypesRes.data ?? []) as unknown as DocTypeRow[])
  const matrix = ((matrixRes.data ?? []) as unknown as MatrixRow[])
  const shipments = ((shipmentsRes.data ?? []) as unknown as ShipmentRow[])
  const compliance = ((complianceRes.data ?? []) as unknown as ComplianceRow[])
  const uploaded = ((uploadedRes.data ?? []) as unknown as UploadedDocRow[])

  const requiredByZone = new Map<string, Set<string>>()
  for (const r of matrix) {
    if (!r.is_required) continue
    const existing = requiredByZone.get(r.free_zone_id) ?? new Set<string>()
    existing.add(r.document_type_id)
    requiredByZone.set(r.free_zone_id, existing)
  }

  const zoneVms: ZoneVm[] = zones.map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
    city: z.city,
    country: z.country,
    customsOfficeCode: z.customs_office_code,
    notes: z.notes,
    isActive: z.is_active,
    requiredDocumentTypeIds: Array.from(requiredByZone.get(z.id) ?? new Set<string>()),
  }))

  const docTypeVms: DocumentTypeVm[] = docTypes.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    applicableTo: d.applicable_to,
    requiredByDefault: d.required_by_default,
    sortOrder: d.sort_order,
    isActive: d.is_active,
  }))

  const complianceById = new Map(compliance.map((c) => [c.shipment_id, c]))
  const uploadedByShipment = new Map<string, UploadedDocRow[]>()
  for (const u of uploaded) {
    const arr = uploadedByShipment.get(u.shipment_id) ?? []
    arr.push(u)
    uploadedByShipment.set(u.shipment_id, arr)
  }

  const shipmentVms: ZoneShipmentVm[] = shipments.map((s) => {
    const c = complianceById.get(s.id)
    const up = uploadedByShipment.get(s.id) ?? []
    const requiredIds = new Set<string>()
    if (s.pickup_free_zone_id) {
      for (const id of requiredByZone.get(s.pickup_free_zone_id) ?? []) requiredIds.add(id)
    }
    if (s.delivery_free_zone_id) {
      for (const id of requiredByZone.get(s.delivery_free_zone_id) ?? []) requiredIds.add(id)
    }
    return {
      id: s.id,
      reference: s.reference,
      status: s.status,
      pickupCity: s.pickup_city,
      deliveryCity: s.delivery_city,
      pickupFreeZoneId: s.pickup_free_zone_id,
      deliveryFreeZoneId: s.delivery_free_zone_id,
      deliveryScheduledAt: s.delivery_scheduled_at,
      clientName: s.client?.business_name ?? '—',
      requiredDocumentTypeIds: Array.from(requiredIds),
      requiredCount: c?.required_count ?? 0,
      uploadedCount: c?.uploaded_count ?? 0,
      complianceStatus: c?.compliance_status ?? 'no_requirement',
      uploaded: up.map((u) => ({
        id: u.id,
        documentTypeId: u.document_type_id,
        documentNumber: u.document_number,
        documentDate: u.document_date,
        fileName: u.file_name,
        mimeType: u.mime_type,
        fileSizeBytes: u.file_size_bytes,
        createdAt: u.created_at,
      })),
    }
  })

  const canEdit =
    user.role === 'super_admin' || user.role === 'company_admin' || user.role === 'dispatcher'

  const incompleteCount = shipmentVms.filter(
    (s) => s.complianceStatus === 'missing' || s.complianceStatus === 'partial',
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" />
            {t('page.zonesCount', { count: zoneVms.filter((z) => z.isActive).length })}
          </span>
        }
      />

      <FreeZonesView
        zones={zoneVms}
        documentTypes={docTypeVms}
        shipments={shipmentVms}
        canEdit={canEdit}
        incompleteCount={incompleteCount}
      />
    </div>
  )
}
