import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Edit, ArrowLeft, Mail, Phone, MapPin, FileText, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { ShipmentStatusBadge } from '@/components/shared/shipment-status-badge'
import { InvoiceStatusBadge } from '@/components/shared/invoice-status-badge'
import { formatDate, formatMAD } from '@/lib/utils/formatters'
import type { ShipmentStatus, InvoiceStatus } from '@/types/database.types'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const [t, tCommon, user, supabase] = await Promise.all([
    getTranslations('clients'),
    getTranslations('common'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  const [{ data: shipments }, { data: invoices }] = await Promise.all([
    supabase
      .from('shipments')
      .select('id, reference, status, pickup_city, delivery_city, total_price, created_at')
      .eq('client_id', id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, due_date, total_amount, amount_paid, status')
      .eq('client_id', id)
      .eq('company_id', user.companyId)
      .order('issue_date', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/clients`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <PageHeader
        title={client.business_name}
        action={
          <Link
            href={`/${locale}/clients/${id}/edit`}
            className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Edit className="h-4 w-4" />
            {tCommon('edit')}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">{t('contactInfo')}</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">{t('phone')}</dt>
                <dd className="font-medium">{client.phone}</dd>
              </div>
            </div>
            {client.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('email')}</dt>
                  <dd className="font-medium break-all">{client.email}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">{t('city')}</dt>
                <dd className="font-medium">{client.city}</dd>
                {client.address && <p className="text-xs text-muted-foreground mt-0.5">{client.address}</p>}
              </div>
            </div>
            {client.ice && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">ICE</dt>
                  <dd className="font-mono text-xs">{client.ice}</dd>
                </div>
              </div>
            )}
          </dl>

          <div className="mt-5 border-t pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('billing')}</h3>
            <p className="text-sm">
              <span className="font-medium">{client.billing_mode === 'per_shipment' ? t('perShipment') : t('monthlyGrouped')}</span>
              <span className="text-muted-foreground"> · {client.payment_terms_days}j</span>
            </p>
          </div>

          {client.notes && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('notes')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Recent shipments + invoices */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-foreground">{t('recentShipments')}</h2>
              <Link
                href={`/${locale}/shipments?client=${id}`}
                className="text-sm text-primary hover:underline"
              >
                {tCommon('viewAll')}
              </Link>
            </div>
            {shipments && shipments.length > 0 ? (
              <div className="divide-y">
                {shipments.map((s) => (
                  <Link
                    key={s.id}
                    href={`/${locale}/shipments/${s.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-mono text-xs font-semibold text-primary">{s.reference}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{s.pickup_city} → {s.delivery_city}</span>
                    <span className="text-sm font-medium">{formatMAD(s.total_price ?? 0)}</span>
                    <ShipmentStatusBadge status={s.status as ShipmentStatus} size="sm" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('noShipmentsYet')}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-foreground">{t('recentInvoices')}</h2>
              <Link
                href={`/${locale}/invoices?client=${id}`}
                className="text-sm text-primary hover:underline"
              >
                {tCommon('viewAll')}
              </Link>
            </div>
            {invoices && invoices.length > 0 ? (
              <div className="divide-y">
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/${locale}/invoices/${inv.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-mono text-xs font-semibold text-primary">{inv.invoice_number}</span>
                    <span className="flex-1 text-xs text-muted-foreground">{formatDate(inv.issue_date)}</span>
                    <span className="text-sm font-medium">{formatMAD(inv.total_amount)}</span>
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} size="sm" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('noInvoicesYet')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
