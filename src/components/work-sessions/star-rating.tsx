'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readOnly?: boolean
  size?: number
  className?: string
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 20,
  className,
}: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= value
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(i)}
            className={cn(
              'transition-transform',
              !readOnly && 'cursor-pointer hover:scale-110 focus-ring rounded-sm',
              readOnly && 'cursor-default',
            )}
            aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={cn(
                filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
