import { useTranslations } from 'next-intl'
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

export function ShipmentTimeline({ status, pickedUpAt, deliveredAt, scheduledAt, createdAt }: ShipmentTimelineProps) {
  const t = useTranslations('shipments.status')

  if (status === 'cancelled' || status === 'failed') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <X className="h-5 w-5 text-destructive" />
        <span className="font-medium text-destructive">{t(status)}</span>
      </div>
    )
  }

  const currentIdx = FLOW.indexOf(status)

  return (
    <ol className="relative space-y-4 ps-6">
      <span className="absolute start-2 top-2 bottom-2 w-0.5 bg-muted" />
      {FLOW.map((step, idx) => {
        const done = idx <= currentIdx
        const isCurrent = idx === currentIdx
        const date = step === 'created' ? createdAt : step === 'picked_up' ? pickedUpAt : step === 'delivered' ? deliveredAt : null

        return (
          <li key={step} className="relative flex items-start gap-3">
            <span
              className={`absolute -start-6 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card ${
                done ? 'bg-primary' : 'bg-muted'
              }`}
            >
              {done && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
            </span>
            <div>
              <p className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'} ${isCurrent ? 'font-semibold text-primary' : ''}`}>
                {t(step)}
              </p>
              {date && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(date).toLocaleString('fr-MA')}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
