import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
} from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { formatMAD } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { MonthlyDossierStatus } from '@/types/database.types'

export const dynamic = 'force-dynamic'

interface DossierRow {
  id: string
  period_month: string
  status: MonthlyDossierStatus
  total_revenue_excl_tax_mad: number
  total_expenses_mad: number
  vat_to_pay_mad: number
  total_documents_count: number
  generated_at: string | null
  sent_at: string | null
  closed_at: string | null
  notes_from_accountant: string | null
}

const STATUS_TONE: Record<MonthlyDossierStatus, { bg: string; text: string }> = {
  in_progress: { bg: 'bg-slate-100', text: 'text-slate-600' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sent: { bg: 'bg-amber-100', text: 'text-amber-800' },
  closed_by_accountant: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

export default async function AccountantDossiersPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('accountant.dossiersList'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'external_accountant') redirect(`/${locale}/dashboard`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('monthly_dossiers')
    .select(
      'id, period_month, status, total_revenue_excl_tax_mad, total_expenses_mad, vat_to_pay_mad, total_documents_count, generated_at, sent_at, closed_at, notes_from_accountant',
    )
    // RLS already filters to the linked company + status sent/closed
    .order('period_month', { ascending: false })
    .limit(60)

  const rows = (data ?? []) as unknown as DossierRow[]
  const pending = rows.filter((r) => r.status === 'sent').length
  const closed = rows.filter((r) => r.status === 'closed_by_accountant').length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex items-center gap-2">
            {pending > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {t('pendingCount', { count: pending })}
              </span>
            )}
            {closed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('closedCount', { count: closed })}
              </span>
            )}
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{t('empty.title')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('empty.subtitle')}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const tone = STATUS_TONE[row.status]
            const periodLabel = new Date(row.period_month).toLocaleDateString(
              locale === 'ar' ? 'ar-MA' : 'fr-FR',
              { month: 'long', year: 'numeric', timeZone: 'UTC' },
            )
            return (
              <Link
                key={row.id}
                href={`/${locale}/accountant/dossiers/${row.id}`}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-soft transition-colors hover:bg-muted/30 focus-ring',
                  row.status === 'sent' && 'border-amber-200',
                  row.status === 'closed_by_accountant' && 'border-emerald-200',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
                    tone.bg,
                    tone.text,
                  )}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-foreground capitalize">
                      {periodLabel}
                    </h3>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        tone.bg,
                        tone.text,
                      )}
                    >
                      {t(`status.${row.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('documentsCount', { count: row.total_documents_count })}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2 text-[11px]">
                    <Stat label={t('revenue')} value={formatMAD(row.total_revenue_excl_tax_mad)} />
                    <Stat label={t('expenses')} value={formatMAD(row.total_expenses_mad)} />
                    <Stat
                      label={t('vat')}
                      value={formatMAD(row.vat_to_pay_mad)}
                      tone="primary"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {row.sent_at
                        ? t('sentOn', {
                            date: new Date(row.sent_at).toLocaleDateString(
                              locale === 'ar' ? 'ar-MA' : 'fr-FR',
                            ),
                          })
                        : '—'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
                      {t('open')}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'primary'
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-[11px] font-semibold',
          tone === 'primary' ? 'text-primary' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}
