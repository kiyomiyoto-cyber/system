import { EmailProvider } from './email-provider'
import { WhatsappProvider } from './whatsapp-provider'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export interface NotificationPayload {
  to: string
  subject?: string
  body: string
  channel: 'email' | 'whatsapp'
  metadata?: Record<string, unknown>
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>
}

const providers: Record<NotificationPayload['channel'], NotificationProvider> = {
  email: new EmailProvider(),
  whatsapp: new WhatsappProvider(),
}

export async function dispatchNotification(
  companyId: string,
  payload: NotificationPayload,
  context?: { userId?: string; relatedId?: string; relatedType?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  // Persist as pending first
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({
      company_id: companyId,
      channel: payload.channel,
      recipient: payload.to,
      subject: payload.subject ?? null,
      body: payload.body,
      status: 'pending',
      attempts: 0,
      related_user_id: context?.userId ?? null,
      related_entity_id: context?.relatedId ?? null,
      related_entity_type: context?.relatedType ?? null,
    })
    .select('id')
    .single()

  if (insertError || !notification) {
    logger.error('notification.insert', { error: insertError?.message })
    return { success: false, error: insertError?.message ?? 'Failed to persist' }
  }

  const provider = providers[payload.channel]
  const result = await provider.send(payload)

  await supabase
    .from('notifications')
    .update({
      status: result.success ? 'sent' : 'failed',
      attempts: 1,
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error ?? null,
    })
    .eq('id', notification.id)

  return result
}
