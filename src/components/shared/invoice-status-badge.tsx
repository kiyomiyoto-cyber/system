import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/types/database.types'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  unpaid: 'bg-amber-100 text-amber-700 border-amber-200',
  partially_paid: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_DOTS: Record<InvoiceStatus, string> = {
  unpaid: 'bg-amber-500',
  partially_paid: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500 animate-pulse',
  cancelled: 'bg-gray-400',
}

interface Props {
  status: InvoiceStatus
  size?: 'sm' | 'md'
  showDot?: boolean
  className?: string
}

export function InvoiceStatusBadge({ status, size = 'md', showDot = true, className }: Props) {
  const t = useTranslations('invoices.status')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        STATUS_STYLES[status],
        className,
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[status])} />}
      {t(status)}
    </span>
  )
}
