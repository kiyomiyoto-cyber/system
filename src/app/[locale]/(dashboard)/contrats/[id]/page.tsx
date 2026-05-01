import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, FileText, ChevronRight } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatDate } from '@/lib/utils/formatters'
import type { ClientContractStatus, ClientContractBillingMode } from '@/types/database.types'
import { ContractForm } from '../contract-form'
import { PricingGridEditor, type PricingRuleViewModel } from './pricing-grid-editor'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface ContractRow {
  id: string
  client_id: string
  contract_number: string | null
  signed_date: string | null
  start_date: string
  end_date: string | null
  payment_terms_days: number
  billing_mode: ClientContractBillingMode
  auto_renewal: boolean
  status: ClientContractStatus
  notes: string | null
  client: { id: string; business_name: string } | null
}

interface RuleRow {
  id: string
  contract_id: string
  route_label: string
  pickup_city: string | null
  delivery_city: string | null
  vehicle_type: 'motorcycle' | 'van' | 'truck' | 'pickup' | null
  base_price_mad: number
  surcharge_night_pct: number
  surcharge_weekend_pct: number
  surcharge_urgent_pct: number
  surcharge_waiting_per_hour_mad: number
  customs_zone: boolean
  notes: string | null
  is_active: boolean
  sort_order: number
}

export default async function ContractDetailPage({ params }: { params: { locale: string; id: string } }) {
  const [t, locale, user] = await Promise.all([
    getTranslations('contracts'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const [contractResult, rulesResult, clientsResult] = await Promise.all([
    supabase
      .from('client_contracts')
      .select('id, client_id, contract_number, signed_date, start_date, end_date, payment_terms_days, billing_mode, auto_renewal, status, notes, client:clients(id, business_name)')
      .eq('id', params.id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('contract_pricing_grid')
      .select('id, contract_id, route_label, pickup_city, delivery_city, vehicle_type, base_price_mad, surcharge_night_pct, surcharge_weekend_pct, surcharge_urgent_pct, surcharge_waiting_per_hour_mad, customs_zone, notes, is_active, sort_order')
      .eq('contract_id', params.id)
      .eq('company_id', user.companyId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('clients')
      .select('id, business_name')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('business_name', { ascending: true }),
  ])

  const contract = contractResult.data as unknown as ContractRow | null
  if (!contract) notFound()

  const rules = ((rulesResult.data ?? []) as unknown as RuleRow[])
  const clients = ((clientsResult.data ?? []) as unknown as Array<{ id: string; business_name: string }>)
  const dateLocale: 'fr' | 'ar' = locale === 'ar' ? 'ar' : 'fr'

  const { data: blTemplatesData } = await supabase
    .from('bl_templates')
    .select('id, name, is_default')
    .eq('client_id', contract.client_id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  type BlTemplateSummary = { id: string; name: string; is_default: boolean }
  const blTemplates = ((blTemplatesData ?? []) as unknown as BlTemplateSummary[])

  const ruleVms: PricingRuleViewModel[] = rules.map((r) => ({
    id: r.id,
    routeLabel: r.route_label,
    pickupCity: r.pickup_city,
    deliveryCity: r.delivery_city,
    vehicleType: r.vehicle_type,
    basePriceMad: Number(r.base_price_mad),
    surchargeNightPct: Number(r.surcharge_night_pct),
    surchargeWeekendPct: Number(r.surcharge_weekend_pct),
    surchargeUrgentPct: Number(r.surcharge_urgent_pct),
    surchargeWaitingPerHourMad: Number(r.surcharge_waiting_per_hour_mad),
    customsZone: r.customs_zone,
    notes: r.notes,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  }))

  const canEdit = user.role !== 'comptable'

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/contrats`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('detail.backToList')}
      </Link>

      <PageHeader
        title={contract.client?.business_name ?? t('detail.title')}
        description={t('detail.subtitle', {
          start: formatDate(contract.start_date, dateLocale),
          end: contract.end_date ? formatDate(contract.end_date, dateLocale) : t('list.openEnded'),
        })}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {canEdit ? (
          <ContractForm
            mode="edit"
            contractId={contract.id}
            clients={clients}
            initial={{
              clientId: contract.client_id,
              contractNumber: contract.contract_number,
              signedDate: contract.signed_date,
              startDate: contract.start_date,
              endDate: contract.end_date,
              paymentTermsDays: contract.payment_terms_days,
              billingMode: contract.billing_mode,
              autoRenewal: contract.auto_renewal,
              status: contract.status,
              notes: contract.notes,
            }}
          />
        ) : (
          <ReadOnlyContractInfo contract={contract} t={t} />
        )}

        <PricingGridEditor
          contractId={contract.id}
          initialRules={ruleVms}
          canEdit={canEdit}
        />
      </div>

      <BlTemplatesCard
        contractId={contract.id}
        templates={blTemplates}
        locale={locale}
      />
    </div>
  )
}

async function BlTemplatesCard({
  contractId,
  templates,
  locale,
}: {
  contractId: string
  templates: Array<{ id: string; name: string; is_default: boolean }>
  locale: string
}) {
  const t = await getTranslations('blTemplates')
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">{t('card.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('card.subtitle')}</p>
          </div>
        </div>
        <Link
          href={`/${locale}/contrats/${contractId}/bl-template`}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          {t('card.manage')}
          <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t('card.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((tmpl) => (
            <li
              key={tmpl.id}
              className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{tmpl.name}</span>
                {tmpl.is_default && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {t('card.defaultBadge')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReadOnlyContractInfo({
  contract,
  t,
}: {
  contract: ContractRow
  t: Awaited<ReturnType<typeof getTranslations<'contracts'>>>
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-foreground">{t('detail.info')}</h2>
      <dl className="space-y-2 text-sm">
        <Row label={t('form.contractNumber')} value={contract.contract_number ?? '—'} />
        <Row label={t('form.startDate')} value={contract.start_date} />
        <Row label={t('form.endDate')} value={contract.end_date ?? '—'} />
        <Row label={t('form.billingMode')} value={t(`billing.${contract.billing_mode}`)} />
        <Row label={t('form.paymentTerms')} value={`${contract.payment_terms_days} j`} />
        <Row label={t('form.status')} value={t(`status.${contract.status}`)} />
        {contract.notes && <Row label={t('form.notes')} value={contract.notes} />}
      </dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}
