import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Globe2 } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CmrView, type CmrRowVm, type EligibleShipmentVm } from './cmr-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface CmrRow {
  id: string
  cmr_number: string
  status: string
  sender_name: string
  consignee_name: string
  delivery_place: string
  delivery_country: string
  taking_over_country: string
  charges_total_mad: number | string | null
  pdf_storage_path: string | null
  pdf_generated_at: string | null
  issued_date: string
  created_at: string
  shipment: { id: string; reference: string } | null
}

interface ShipmentRow {
  id: string
  reference: string
  is_international: boolean
  pickup_city: string
  delivery_city: string
  pickup_country: string
  delivery_country: string
  status: string
  cmr_document_id: string | null
  client: { business_name: string } | null
}

export default async function CmrPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('cmr'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  // The CMR module is international-only — gate the page on the flag.
  // The data is always available; the UI is just hidden in domestic mode.
  const internationalEnabled = process.env.NEXT_PUBLIC_INTERNATIONAL_ENABLED === 'true'

  const supabase = await createClient()

  const [cmrRes, eligibleRes] = await Promise.all([
    supabase
      .from('cmr_documents')
      .select(
        'id, cmr_number, status, sender_name, consignee_name, delivery_place, delivery_country, taking_over_country, charges_total_mad, pdf_storage_path, pdf_generated_at, issued_date, created_at, shipment:shipments(id, reference)',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    // International shipments without a CMR yet
    supabase
      .from('shipments')
      .select(
        'id, reference, is_international, pickup_city, delivery_city, pickup_country, delivery_country, status, cmr_document_id, client:clients(business_name)',
      )
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .is('cmr_document_id', null)
      .or('is_international.eq.true,pickup_country.neq.MA,delivery_country.neq.MA')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const cmrs = ((cmrRes.data ?? []) as unknown as CmrRow[])
  const eligible = ((eligibleRes.data ?? []) as unknown as ShipmentRow[])

  const cmrVms: CmrRowVm[] = cmrs.map((c) => ({
    id: c.id,
    cmrNumber: c.cmr_number,
    status: c.status as CmrRowVm['status'],
    senderName: c.sender_name,
    consigneeName: c.consignee_name,
    deliveryPlace: c.delivery_place,
    deliveryCountry: c.delivery_country,
    takingOverCountry: c.taking_over_country,
    chargesTotalMad: c.charges_total_mad == null ? 0 : Number(c.charges_total_mad),
    hasPdf: !!c.pdf_storage_path,
    pdfGeneratedAt: c.pdf_generated_at,
    issuedDate: c.issued_date,
    createdAt: c.created_at,
    shipmentId: c.shipment?.id ?? null,
    shipmentReference: c.shipment?.reference ?? '—',
  }))

  const eligibleVms: EligibleShipmentVm[] = eligible.map((s) => ({
    id: s.id,
    reference: s.reference,
    pickupCity: s.pickup_city,
    deliveryCity: s.delivery_city,
    pickupCountry: s.pickup_country,
    deliveryCountry: s.delivery_country,
    status: s.status,
    isInternational: s.is_international,
    clientName: s.client?.business_name ?? '—',
  }))

  const canEdit =
    user.role === 'super_admin' || user.role === 'company_admin' || user.role === 'dispatcher'

  const counts = {
    draft: cmrVms.filter((c) => c.status === 'draft').length,
    issued: cmrVms.filter((c) => c.status === 'issued').length,
    signed: cmrVms.filter((c) => c.status === 'signed').length,
    cancelled: cmrVms.filter((c) => c.status === 'cancelled').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          internationalEnabled ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <Globe2 className="h-3.5 w-3.5" />
              {t('page.internationalEnabled')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <Globe2 className="h-3.5 w-3.5" />
              {t('page.internationalDisabled')}
            </span>
          )
        }
      />

      <CmrView
        cmrs={cmrVms}
        eligibleShipments={eligibleVms}
        canEdit={canEdit}
        counts={counts}
        internationalEnabled={internationalEnabled}
      />
    </div>
  )
}
