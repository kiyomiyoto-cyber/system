import { getTranslations } from 'next-intl/server'
import { formatMAD } from '@/lib/utils/formatters'
import type {
  AccountingDocumentCategory,
  AccountingDocumentStatus,
} from '@/types/database.types'

interface MonthDocRow {
  document_category: AccountingDocumentCategory
  amount_ttc: number
  vat_amount: number | null
  status: AccountingDocumentStatus
}

interface MonthlyRecapProps {
  docs: MonthDocRow[]
  revenueExclTax: number
  vatCollected: number
}

const RECAP_ORDER: readonly AccountingDocumentCategory[] = [
  'fuel_receipt',
  'toll_receipt',
  'maintenance_receipt',
  'driver_advance',
  'salary_slip',
  'cnss_payment',
  'ir_payment',
  'phone_internet',
  'office_rent',
  'insurance',
  'invoice_supplier',
  'bank_fee',
  'other',
]

export async function MonthlyRecap({ docs, revenueExclTax, vatCollected }: MonthlyRecapProps) {
  const t = await getTranslations('accounting')

  const grouped = new Map<AccountingDocumentCategory, { count: number; total: number }>()
  for (const doc of docs) {
    if (doc.status === 'rejected') continue
    if (doc.document_category === 'invoice_client') continue
    const current = grouped.get(doc.document_category) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += Number(doc.amount_ttc)
    grouped.set(doc.document_category, current)
  }

  const rows = RECAP_ORDER
    .map((cat) => ({ cat, ...(grouped.get(cat) ?? { count: 0, total: 0 }) }))
    .filter((r) => r.count > 0)

  const totalExpenses = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">{t('recap.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('recap.subtitle')}</p>
      </div>

      <div className="grid gap-0 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
        <div>
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('recap.expenses')}
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{t('recap.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.cat}>
                    <td className="px-5 py-2.5 text-foreground">{t(`categories.${r.cat}`)}</td>
                    <td className="px-3 py-2.5 text-end text-xs text-muted-foreground">
                      {t('recap.docsCount', { count: r.count })}
                    </td>
                    <td className="px-5 py-2.5 text-end font-mono text-foreground">
                      {formatMAD(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-5 py-3 text-foreground">{t('recap.totalExpenses')}</td>
                  <td />
                  <td className="px-5 py-3 text-end font-mono text-foreground">
                    {formatMAD(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div>
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('recap.revenue')}
          </div>
          <dl className="divide-y text-sm">
            <div className="flex items-center justify-between px-5 py-2.5">
              <dt className="text-foreground">{t('recap.revenueExclTax')}</dt>
              <dd className="font-mono text-foreground">{formatMAD(revenueExclTax)}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-2.5">
              <dt className="text-foreground">{t('recap.vatCollected')}</dt>
              <dd className="font-mono text-foreground">{formatMAD(vatCollected)}</dd>
            </div>
            <div className="flex items-center justify-between bg-muted/30 px-5 py-3 font-semibold">
              <dt className="text-foreground">{t('recap.revenueInclTax')}</dt>
              <dd className="font-mono text-foreground">{formatMAD(revenueExclTax + vatCollected)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
