import { logger } from '@/lib/utils/logger'
import type { NotificationProvider, NotificationPayload } from './index'

// Policy: WhatsApp is reserved for internal use only (dispatcher↔driver and
// admin escalations). Industrial clients run on SAP/Oracle and receive any
// status updates manually, case by case. Auto-fanout to client recipients
// is rejected here to prevent regressions when WhatsApp gets wired up.
export class WhatsappProvider implements NotificationProvider {
  private enabled: boolean

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true'
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (payload.audience === 'client') {
      logger.warn('whatsapp.blocked_client_audience', { recipientType: 'client' })
      return { success: false, error: 'WhatsApp to clients is disabled by policy' }
    }

    if (!this.enabled) {
      logger.info('whatsapp.stub', { to: payload.to.slice(0, 6) + '***' })
      return { success: true }
    }

    return { success: false, error: 'WhatsApp provider not implemented' }
  }
}
