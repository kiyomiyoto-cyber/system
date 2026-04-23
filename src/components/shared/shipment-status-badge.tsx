import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { ShipmentStatus } from '@/types/database.types'

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  created: 'bg-slate-100 text-slate-700 border-slate-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  picked_up: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  in_transit: 'bg-amber-100 text-amber-700 border-amber-200',
  customs_clearance: 'bg-orange-100 text-orange-700 border-orange-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_DOTS: Record<ShipmentStatus, string> = {
  created: 'bg-slate-400',
  assigned: 'bg-blue-500',
  picked_up: 'bg-indigo-500',
  in_transit: 'bg-amber-500 animate-pulse',
  customs_clearance: 'bg-orange-500',
  delivered: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-400',
}

interface Props {
  status: ShipmentStatus
  showDot?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ShipmentStatusBadge({ status, showDot = true, size = 'md', className }: Props) {
  const t = useTranslations('shipments.status')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        STATUS_STYLES[status],
        className,
      )}
    >
      {showDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[status])} />
      )}
      {t(status)}
    </span>
  )
}
