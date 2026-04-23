'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { toggleDriverAvailability } from '@/actions/drivers'

interface AvailabilityToggleProps {
  driverId: string
  initialAvailable: boolean
}

export function AvailabilityToggle({ driverId, initialAvailable }: AvailabilityToggleProps) {
  const t = useTranslations('drivers')
  const [available, setAvailable] = useState(initialAvailable)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newValue = !available
    setAvailable(newValue) // optimistic
    startTransition(async () => {
      const result = await toggleDriverAvailability(driverId, newValue)
      if (!result.success) {
        setAvailable(!newValue) // rollback
        toast.error(result.error)
      } else {
        toast.success(newValue ? t('marked.available') : t('marked.unavailable'))
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        available
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${available ? 'bg-green-600' : 'bg-gray-400'}`} />
      {available ? t('available') : t('unavailable')}
    </button>
  )
}
