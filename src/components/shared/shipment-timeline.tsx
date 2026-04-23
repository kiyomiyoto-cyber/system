'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Check, Clock, X } from 'lucide-react'
import type { ShipmentStatus } from '@/types/database.types'

interface ShipmentTimelineProps {
  status: ShipmentStatus
  pickedUpAt?: string | null
  deliveredAt?: string | null
  scheduledAt?: string | null
  createdAt: string
}

const FLOW: ShipmentStatus[] = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered']

const ease = [0.22, 1, 0.36, 1] as const

export function ShipmentTimeline({
  status,
  pickedUpAt,
  deliveredAt,
  scheduledAt,
  createdAt,
}: ShipmentTimelineProps) {
  const t = useTranslations('shipments.status')

  if (status === 'cancelled' || status === 'failed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        <X className="h-5 w-5 text-destructive" />
        <span className="font-medium text-destructive">{t(status)}</span>
      </motion.div>
    )
  }

  const currentIdx = FLOW.indexOf(status)
  const progress = currentIdx < 0 ? 0 : (currentIdx / (FLOW.length - 1)) * 100

  return (
    <ol className="relative space-y-5 ps-6">
      {/* Track background */}
      <span className="absolute start-2 top-2 bottom-2 w-0.5 bg-muted" />
      {/* Animated progress */}
      <motion.span
        initial={{ height: '0%' }}
        animate={{ height: `${progress}%` }}
        transition={{ duration: 0.6, ease }}
        className="absolute start-2 top-2 w-0.5 origin-top bg-primary"
        style={{ maxHeight: 'calc(100% - 1rem)' }}
      />

      {FLOW.map((step, idx) => {
        const done = idx <= currentIdx
        const isCurrent = idx === currentIdx
        const date =
          step === 'created'
            ? createdAt
            : step === 'picked_up'
              ? pickedUpAt
              : step === 'delivered'
                ? deliveredAt
                : step === 'in_transit'
                  ? scheduledAt
                  : null

        return (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease, delay: idx * 0.06 }}
            className="relative flex items-start gap-3"
          >
            <span
              className={`absolute -start-6 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card ${
                done ? 'bg-primary' : 'bg-muted'
              }`}
            >
              {done && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
              {isCurrent && (
                <motion.span
                  aria-hidden
                  initial={{ scale: 0.6, opacity: 0.7 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{
                    duration: 1.6,
                    ease: 'easeOut',
                    repeat: Infinity,
                  }}
                  className="absolute inset-0 rounded-full bg-primary/40"
                />
              )}
            </span>
            <div>
              <p
                className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'} ${
                  isCurrent ? 'font-semibold text-primary' : ''
                }`}
              >
                {t(step)}
              </p>
              {date && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(date).toLocaleString('fr-MA')}
                </p>
              )}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
