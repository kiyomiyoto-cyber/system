import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ScrollText } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ActiviteView, type AuditEntry, type FilterOption } from './activite-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'comptable']

interface SearchParams {
  entity?: string
  action?: string
  actor?: string
  from?: string
  to?: string
}

interface AuditRow {
  id: string
  company_id: string
  entity_type: string
  entity_id: string
  action: string
  notes: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  actor_user_id: string | null
  actor_role: string | null
  actor_name: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export default async function ActiviteComptablePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations('audit'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId && user.role !== 'super_admin') redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  // Build query.
  // super_admin sees rows across all companies (per Prompt 2 spec).
  // company_admin/comptable: scoped via RLS to their company.
  let query = supabase
    .from('accounting_audit_log')
    .select(
      'id, company_id, entity_type, entity_id, action, notes, before_state, after_state, actor_user_id, actor_role, actor_name, ip_address, user_agent, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (searchParams.entity) query = query.eq('entity_type', searchParams.entity)
  if (searchParams.action) query = query.eq('action', searchParams.action)
  if (searchParams.actor) query = query.eq('actor_user_id', searchParams.actor)
  if (searchParams.from) query = query.gte('created_at', searchParams.from)
  if (searchParams.to) query = query.lte('created_at', searchParams.to + 'T23:59:59.999Z')

  const { data: rawRows } = await query
  const rows = ((rawRows ?? []) as unknown as AuditRow[])

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    notes: r.notes,
    beforeState: r.before_state,
    afterState: r.after_state,
    actorUserId: r.actor_user_id,
    actorRole: r.actor_role,
    actorName: r.actor_name,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }))

  // Build filter options from the visible dataset (cheap, no extra round-trip)
  const entityOptions: FilterOption[] = Array.from(
    new Set(entries.map((e) => e.entityType)),
  )
    .sort()
    .map((v) => ({ value: v, label: t(`entities.${v}`) }))
  const actionOptions: FilterOption[] = Array.from(
    new Set(entries.map((e) => e.action)),
  )
    .sort()
    .map((v) => ({ value: v, label: t(`actions.${v}`) }))
  const actorOptions: FilterOption[] = Array.from(
    new Map(
      entries
        .filter((e) => e.actorUserId)
        .map((e) => [e.actorUserId!, e.actorName ?? e.actorUserId!]),
    ),
  )
    .sort((a, b) => (a[1] ?? '').localeCompare(b[1] ?? ''))
    .map(([value, label]) => ({ value, label: label ?? value }))

  // KPIs
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const last7d = entries.filter((e) => new Date(e.createdAt).getTime() >= sevenDaysAgoMs).length
  const todayMs = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()
  const today = entries.filter((e) => new Date(e.createdAt).getTime() >= todayMs).length
  const externalAccountantActions = entries.filter((e) => e.actorRole === 'external_accountant').length
  const distinctActors = new Set(entries.map((e) => e.actorUserId).filter(Boolean)).size

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.subtitle')}
        action={
          <span
            className={
              isSuperAdmin
                ? 'inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 ring-1 ring-violet-200'
                : 'inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground'
            }
          >
            <ScrollText className="h-3.5 w-3.5" />
            {isSuperAdmin ? t('page.superAdminBadge') : t('page.tenantScopedBadge')}
          </span>
        }
      />

      <ActiviteView
        entries={entries}
        entityOptions={entityOptions}
        actionOptions={actionOptions}
        actorOptions={actorOptions}
        kpis={{ last7d, today, externalAccountantActions, distinctActors }}
        showCompanyColumn={isSuperAdmin}
        initialFilters={{
          entity: searchParams.entity ?? '',
          action: searchParams.action ?? '',
          actor: searchParams.actor ?? '',
          from: searchParams.from ?? '',
          to: searchParams.to ?? '',
        }}
      />
    </div>
  )
}
