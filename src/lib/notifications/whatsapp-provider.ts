import { logger } from '@/lib/utils/logger'
import type { NotificationProvider, NotificationPayload } from './index'

export class WhatsappProvider implements NotificationProvider {
  private enabled: boolean

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true'
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.enabled) {
      logger.info('whatsapp.stub', { to: payload.to.slice(0, 6) + '***' })
      return { success: true }
    }

    // TODO: integrate WhatsApp Business API when enabled
    logger.warn('whatsapp.not_implemented', {})
    return { success: false, error: 'WhatsApp provider not implemented' }
  }
}
