import 'server-only'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type {
  AccountingAuditAction,
  AccountingAuditEntity,
} from '@/types/database.types'

interface RecordAuditParams {
  companyId: string
  entityType: AccountingAuditEntity
  entityId: string
  action: AccountingAuditAction
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  notes?: string | null
  actor: {
    userId: string
    role: string
    name: string
  }
}

function readClientIp(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]
    if (first) return first.trim()
  }
  return headerStore.get('x-real-ip') ?? headerStore.get('cf-connecting-ip')
}

export async function recordAccountingAudit(params: RecordAuditParams): Promise<void> {
  const headerStore = await headers()
  const ip = readClientIp(headerStore)
  const ua = headerStore.get('user-agent')

  const service = await createServiceClient()
  const { error } = await service.from('accounting_audit_log').insert({
    company_id: params.companyId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    notes: params.notes ?? null,
    actor_user_id: params.actor.userId,
    actor_role: params.actor.role,
    actor_name: params.actor.name,
    ip_address: ip,
    user_agent: ua,
  })

  if (error) {
    // Audit failure must NOT break the user-facing action — but it must
    // be visible: the audit log is a compliance commitment (Prompt 2).
    logger.error('accounting.audit.insert_failed', {
      action: 'recordAccountingAudit',
      companyId: params.companyId,
      entityId: params.entityId,
      error: error.message,
    })
  }
}
