import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, Download, FileText, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceStatusBadge } from '@/components/shared/invoice-status-badge'
import { RecordPaymentDialog } from './record-payment-dialog'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import type { InvoiceStatus } from '@/types/database.types'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const [t, tCommon, user, supabase] = await Promise.all([
    getTranslations('invoices'),
    getTranslations('common'),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user?.companyId) return null

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`*, client:clients(id, business_name, contact_phone, contact_email, city, tax_id)`)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()

  if (!invoice) notFound()

  const client = invoice.client as { id: string; business_name: string; contact_phone: string | null; contact_email: string | null; city: string; tax_id: string | null } | null

  // Resolve shipment ids via the invoice_shipments join table.
  const { data: shipmentLinks } = await supabase
    .from('invoice_shipments')
    .select('shipment_id')
    .eq('invoice_id', id)
  const linkedIds = (shipmentLinks ?? []).map((l) => l.shipment_id)

  const [{ data: shipments }, { data: payments }] = await Promise.all([
    linkedIds.length > 0
      ? supabase
          .from('shipments')
          .select('id, reference, pickup_city, delivery_city, distance_km, price_excl_tax, price_incl_tax')
          .in('id', linkedIds)
      : Promise.resolve({ data: [] as Array<{ id: string; reference: string; pickup_city: string; delivery_city: string; distance_km: number | null; price_excl_tax: number | null; price_incl_tax: number | null }> }),
    supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', id)
      .order('payment_date', { ascending: false }),
  ])

  const balance = Number(invoice.total_incl_tax) - Number(invoice.amount_paid ?? 0)

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/invoices`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <PageHeader
        title={invoice.invoice_number}
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
              {t('downloadPdf')}
            </a>
            {balance > 0 && invoice.status !== 'cancelled' && (
              <RecordPaymentDialog invoiceId={id} balance={balance} />
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Summary card */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('issueDate')}</p>
                <p className="font-medium">{formatDate(invoice.issued_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dueDate')}</p>
                <p className="font-medium">{formatDate(invoice.due_at)}</p>
              </div>
              <InvoiceStatusBadge status={invoice.status as InvoiceStatus} size="md" />
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold text-foreground">{t('shipments')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('reference')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('route')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('distance')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('amountExclTax')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shipments?.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/shipments/${s.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {s.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.pickup_city} → {s.delivery_city}</td>
                    <td className="px-4 py-3 text-end text-xs text-muted-foreground">{s.distance_km?.toFixed(1)} km</td>
                    <td className="px-4 py-3 text-end font-medium">{formatMAD(Number(s.price_excl_tax ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t bg-muted/20 px-5 py-4">
              <dl className="ms-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t('subtotal')}</dt><dd>{formatMAD(Number(invoice.subtotal_excl_tax))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t('vat')}</dt><dd>{formatMAD(Number(invoice.tax_amount))}</dd></div>
                <div className="flex justify-between border-t pt-2"><dt className="font-semibold">{t('total')}</dt><dd className="font-bold">{formatMAD(Number(invoice.total_incl_tax))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t('amountPaid')}</dt><dd className="text-green-600">{formatMAD(Number(invoice.amount_paid ?? 0))}</dd></div>
                <div className="flex justify-between border-t pt-2"><dt className="font-semibold">{t('balance')}</dt><dd className={`font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>{formatMAD(balance)}</dd></div>
              </dl>
            </div>
          </div>

          {/* Payments history */}
          {payments && payments.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-foreground">{t('paymentsReceived')}</h2>
              </div>
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{formatMAD(p.amount)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(p.payment_date)} · {t(`paymentMethod.${p.payment_method}`)}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Client info */}
        {client && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-foreground">{t('billedTo')}</h2>
            <Link href={`/${locale}/clients/${client.id}`} className="text-base font-medium text-primary hover:underline">
              {client.business_name}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">{client.city}</p>
            {client.contact_phone && <p className="mt-1 text-sm text-muted-foreground">{client.contact_phone}</p>}
            {client.contact_email && <p className="text-sm text-muted-foreground break-all">{client.contact_email}</p>}
            {client.tax_id && <p className="mt-2 text-xs font-mono text-muted-foreground">ICE: {client.tax_id}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
