'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const

export type InboxKind = 'whatsapp_out' | 'notification_out'
export type InboxAudience = 'driver' | 'client' | 'subcontractor' | 'internal'

export interface InboxRow {
  feedId: string
  kind: InboxKind
  direction: 'out'
  sourceId: string
  audience: InboxAudience | string
  recipient: string | null
  recipientName: string | null
  subject: string | null
  body: string
  templateKey: string | null
  shipmentId: string | null
  clientId: string | null
  driverId: string | null
  subcontractorId: string | null
  invoiceId: string | null
  status: string
  errorMessage: string | null
  occurredAt: string
  actorUserId: string | null
  isRead: boolean
}

interface ListInboxFilters {
  kind?: InboxKind | 'all'
  audience?: InboxAudience | 'all'
  shipmentId?: string
  clientId?: string
  search?: string
  unreadOnly?: boolean
  limit?: number
}

const filtersSchema = z.object({
  kind: z.enum(['whatsapp_out', 'notification_out', 'all']).optional(),
  audience: z.enum(['driver', 'client', 'subcontractor', 'internal', 'all']).optional(),
  shipmentId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

export async function listInbox(
  rawFilters: ListInboxFilters = {},
): Promise<ActionResult<InboxRow[]>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { data: null, error: 'Non autorisé.' }
  }

  const parsed = filtersSchema.safeParse(rawFilters)
  if (!parsed.success) {
    return { data: null, error: 'Filtres invalides.' }
  }
  const f = parsed.data
  const limit = f.limit ?? 200

  const supabase = await createClient()

  let query = supabase
    .from('v_inbox_unified')
    .select('*')
    .eq('company_id', user.companyId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (f.kind && f.kind !== 'all') query = query.eq('kind', f.kind)
  if (f.audience && f.audience !== 'all') query = query.eq('audience', f.audience)
  if (f.shipmentId) query = query.eq('shipment_id', f.shipmentId)
  if (f.clientId) query = query.eq('client_id', f.clientId)
  if (f.search && f.search.length > 0) {
    const s = `%${f.search.replace(/[%_]/g, (m) => `\\${m}`)}%`
    query = query.or(`body.ilike.${s},subject.ilike.${s},recipient.ilike.${s},recipient_name.ilike.${s}`)
  }

  const { data, error } = await query
  if (error) {
    logger.error('inbox.list_failed', {
      action: 'listInbox',
      companyId: user.companyId,
      error: error.message,
    })
    return { data: null, error: error.message }
  }

  type Row = {
    feed_id: string
    kind: InboxKind
    direction: 'out'
    source_id: string
    audience: string
    recipient: string | null
    recipient_name: string | null
    subject: string | null
    body: string
    template_key: string | null
    shipment_id: string | null
    client_id: string | null
    driver_id: string | null
    subcontractor_id: string | null
    invoice_id: string | null
    status: string
    error_message: string | null
    occurred_at: string
    actor_user_id: string | null
  }
  const rows = (data ?? []) as unknown as Row[]

  // Lookup read receipts for the current user across these rows.
  const reads = await supabase
    .from('inbox_reads')
    .select('kind, source_id')
    .eq('user_id', user.id)
    .eq('company_id', user.companyId)
    .in(
      'source_id',
      rows.map((r) => r.source_id),
    )
  type ReadRow = { kind: InboxKind; source_id: string }
  const readSet = new Set<string>(
    ((reads.data ?? []) as unknown as ReadRow[]).map((r) => `${r.kind}:${r.source_id}`),
  )

  const mapped: InboxRow[] = rows.map((r) => ({
    feedId: r.feed_id,
    kind: r.kind,
    direction: r.direction,
    sourceId: r.source_id,
    audience: r.audience,
    recipient: r.recipient,
    recipientName: r.recipient_name,
    subject: r.subject,
    body: r.body,
    templateKey: r.template_key,
    shipmentId: r.shipment_id,
    clientId: r.client_id,
    driverId: r.driver_id,
    subcontractorId: r.subcontractor_id,
    invoiceId: r.invoice_id,
    status: r.status,
    errorMessage: r.error_message,
    occurredAt: r.occurred_at,
    actorUserId: r.actor_user_id,
    isRead: readSet.has(`${r.kind}:${r.source_id}`),
  }))

  const filtered = f.unreadOnly ? mapped.filter((m) => !m.isRead) : mapped
  return { data: filtered, error: null }
}

const markReadSchema = z.object({
  kind: z.enum(['whatsapp_out', 'notification_out']),
  sourceId: z.string().uuid(),
})

export async function markInboxRead(
  rawInput: z.input<typeof markReadSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }

  const parsed = markReadSchema.safeParse(rawInput)
  if (!parsed.success) return { data: null, error: 'Données invalides.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inbox_reads')
    .upsert(
      {
        company_id: user.companyId,
        user_id: user.id,
        kind: parsed.data.kind,
        source_id: parsed.data.sourceId,
      },
      { onConflict: 'user_id,kind,source_id' },
    )
    .select('id')
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Échec.' }
  }
  return { data: { id: data.id }, error: null }
}

export async function markAllInboxRead(): Promise<ActionResult<{ count: number }>> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { data: null, error: 'Non autorisé.' }

  const supabase = await createClient()

  // Fetch unread items (last 500) and bulk insert reads.
  const { data: feed } = await supabase
    .from('v_inbox_unified')
    .select('kind, source_id')
    .eq('company_id', user.companyId)
    .order('occurred_at', { ascending: false })
    .limit(500)
  type FeedRow = { kind: InboxKind; source_id: string }
  const feedRows = (feed ?? []) as unknown as FeedRow[]
  if (feedRows.length === 0) return { data: { count: 0 }, error: null }

  const companyId = user.companyId
  const userId = user.id
  const { error } = await supabase.from('inbox_reads').upsert(
    feedRows.map((r) => ({
      company_id: companyId,
      user_id: userId,
      kind: r.kind,
      source_id: r.source_id,
    })),
    { onConflict: 'user_id,kind,source_id', ignoreDuplicates: true },
  )

  if (error) return { data: null, error: error.message }
  return { data: { count: feedRows.length }, error: null }
}
