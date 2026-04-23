import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  iconColor?: string
  className?: string
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  iconColor = 'text-primary',
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10',
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
    </div>
  )
}
