'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenderContextKind } from '@/actions/whatsapp'
import { WhatsappSendDialog } from './whatsapp-send-dialog'

interface WhatsappSendButtonProps {
  context: RenderContextKind
  variant?: 'default' | 'icon'
  className?: string
}

/**
 * Server-component-friendly trigger: renders a button, opens the dialog
 * when clicked. The dialog handles template loading, rendering, send,
 * and audit log internally.
 */
export function WhatsappSendButton({
  context,
  variant = 'default',
  className,
}: WhatsappSendButtonProps) {
  const t = useTranslations('whatsapp')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors focus-ring',
          variant === 'default'
            ? 'border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100'
            : 'h-8 w-8 justify-center text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700',
          className,
        )}
        aria-label={t('button.send')}
      >
        <MessageCircle className={variant === 'icon' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {variant === 'default' && t('button.send')}
      </button>
      {open && (
        <WhatsappSendDialog
          open={open}
          onOpenChange={setOpen}
          context={context}
        />
      )}
    </>
  )
}
