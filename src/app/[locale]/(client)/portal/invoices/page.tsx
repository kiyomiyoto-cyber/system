import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { FileText, Download, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { InvoiceStatusBadge } from '@/components/shared/invoice-status-badge'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import type { InvoiceStatus } from '@/types/database.types'

export default async function ClientInvoicesPage() {
  const [t, tCommon, locale, user, supabase] = await Promise.all([
    getTranslations('client'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
  ])

  if (!user || !user.companyId) return null

  const companyId = user.companyId
  const isAdminPreview = user.role !== 'client'

  const { data: clientRecord } = isAdminPreview
    ? { data: null as { id: string; business_name: string } | null }
    : await supabase
        .from('clients')
        .select('id, business_name')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .single()

  const baseInvoices = supabase
    .from('invoices')
    .select('id, invoice_number, issued_at, due_at, total_incl_tax, amount_paid, status')
    .eq('company_id', companyId)
    .order('issued_at', { ascending: false })
    .limit(50)

  const { data: invoices } = isAdminPreview
    ? await baseInvoices
    : clientRecord
      ? await baseInvoices.eq('client_id', clientRecord.id)
      : { data: [] }

  const today = new Date()
  const isOverdue = (dueDate: string, status: InvoiceStatus) =>
    status !== 'paid' && status !== 'cancelled' && new Date(dueDate) < today

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('myInvoices')}</h1>
        {clientRecord && <p className="mt-0.5 text-sm text-muted-foreground">{clientRecord.business_name}</p>}
      </div>

      {invoices && invoices.length > 0 ? (
        <ul className="space-y-3">
          {invoices.map((inv) => {
            const balance = Number(inv.total_incl_tax) - Number(inv.amount_paid ?? 0)
            const overdue = isOverdue(inv.due_at, inv.status as InvoiceStatus)
            return (
              <li key={inv.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{inv.invoice_number}</span>
                      <InvoiceStatusBadge status={inv.status as InvoiceStatus} size="sm" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(inv.issued_at)} · {t('dueDate')}: {' '}
                      <span className={overdue ? 'font-semibold text-destructive' : ''}>
                        {overdue && <AlertTriangle className="inline h-3 w-3 me-1" />}
                        {formatDate(inv.due_at)}
                      </span>
                    </p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="text-base font-bold">{formatMAD(Number(inv.total_incl_tax))}</span>
                      {balance > 0 && (
                        <span className="text-xs text-destructive">{t('balance')}: {formatMAD(balance)}</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{t('noInvoices')}</p>
        </div>
      )}
    </div>
  )
}
