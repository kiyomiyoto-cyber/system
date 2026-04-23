'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { assignDriver } from '@/actions/shipments'

interface AssignDriverPanelProps {
  shipmentId: string
  drivers: Array<{ id: string; full_name: string; is_available: boolean }>
}

export function AssignDriverPanel({ shipmentId, drivers }: AssignDriverPanelProps) {
  const t = useTranslations('shipments')
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAssign() {
    if (!selected) return
    startTransition(async () => {
      const result = await assignDriver(shipmentId, selected)
      if (result.success) {
        toast.success(t('driverAssigned'))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{t('selectDriver')}</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id} disabled={!d.is_available}>
            {d.full_name} {!d.is_available && `(${t('unavailable')})`}
          </option>
        ))}
      </select>
      <button
        onClick={handleAssign}
        disabled={!selected || isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('assign')}
      </button>
    </div>
  )
}
