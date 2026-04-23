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

interface Props {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusBadge({ status, className }: Props) {
  const t = useTranslations('invoices.status')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      {t(status)}
    </span>
  )
}
