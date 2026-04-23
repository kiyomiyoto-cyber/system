import { logger } from '@/lib/utils/logger'
import type { NotificationProvider, NotificationPayload } from './index'

export class EmailProvider implements NotificationProvider {
  private apiKey: string
  private fromAddress: string

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY ?? ''
    this.fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@tms.local'
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      logger.warn('email.disabled', { reason: 'RESEND_API_KEY not set' })
      return { success: false, error: 'Email provider not configured' }
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [payload.to],
          subject: payload.subject ?? '(no subject)',
          html: payload.body,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        logger.error('email.send_failed', { status: res.status, body: text })
        return { success: false, error: `Resend ${res.status}: ${text}` }
      }

      return { success: true }
    } catch (err) {
      logger.error('email.send_error', { error: (err as Error).message })
      return { success: false, error: (err as Error).message }
    }
  }
}
