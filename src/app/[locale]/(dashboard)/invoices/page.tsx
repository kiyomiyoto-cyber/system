import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { FileText, Search, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceStatusBadge } from '@/components/shared/invoice-status-badge'
import { formatMAD, formatDate } from '@/lib/utils/formatters'
import type { InvoiceStatus } from '@/types/database.types'

const STATUSES: InvoiceStatus[] = ['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled']

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const [t, tCommon, locale, user, supabase, sp] = await Promise.all([
    getTranslations('invoices'),
    getTranslations('common'),
    getLocale(),
    getAuthenticatedUser(),
    createClient(),
    searchParams,
  ])

  if (!user?.companyId) return null

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, issue_date, due_date, total_amount, amount_paid, status,
      client:clients(business_name)
    `)
    .eq('company_id', user.companyId)
    .order('issue_date', { ascending: false })

  if (sp.status && sp.status !== 'all') query = query.eq('status', sp.status as InvoiceStatus)
  if (sp.q) query = query.ilike('invoice_number', `%${sp.q}%`)

  const { data: invoices } = await query.limit(100)
  const activeFilter = sp.status ?? 'all'

  const today = new Date()
  const isOverdue = (dueDate: string, status: InvoiceStatus) => {
    return status !== 'paid' && status !== 'cancelled' && new Date(dueDate) < today
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />

      <form className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={sp.q}
          placeholder={t('searchByNumber')}
          className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={`/${locale}/invoices`}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          {tCommon('all')}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/invoices?status=${s}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {invoices && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('number')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('client')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('issueDate')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('dueDate')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('amount')}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('balance')}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('status.label')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => {
                  const client = inv.client as { business_name: string } | null
                  const balance = inv.total_amount - (inv.amount_paid ?? 0)
                  const overdue = isOverdue(inv.due_date, inv.status as InvoiceStatus)
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/${locale}/invoices/${inv.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{client?.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={overdue ? 'font-semibold text-destructive flex items-center gap-1' : 'text-muted-foreground'}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {formatDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-medium">{formatMAD(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-end font-medium">{balance > 0 ? formatMAD(balance) : '—'}</td>
                      <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status as InvoiceStatus} size="sm" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">{t('noInvoices')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('noInvoicesHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
