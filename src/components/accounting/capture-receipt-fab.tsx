'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Camera, FileText, Loader2, X } from 'lucide-react'
import { captureAccountingDocument } from '@/actions/accounting'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database.types'

interface CaptureReceiptFabProps {
  userRole: UserRole
  companyId: string | null
}

type CaptureCategory =
  | 'fuel_receipt'
  | 'toll_receipt'
  | 'maintenance_receipt'
  | 'invoice_supplier'
  | 'driver_advance'
  | 'phone_internet'
  | 'office_rent'
  | 'insurance'
  | 'other'

interface CategoryOption {
  key: CaptureCategory
  emoji: string
}

const CATEGORIES: readonly CategoryOption[] = [
  { key: 'fuel_receipt',         emoji: '⛽' },
  { key: 'toll_receipt',         emoji: '🛣️' },
  { key: 'maintenance_receipt',  emoji: '🔧' },
  { key: 'invoice_supplier',     emoji: '📄' },
  { key: 'driver_advance',       emoji: '💰' },
  { key: 'phone_internet',       emoji: '📞' },
  { key: 'office_rent',          emoji: '🏢' },
  { key: 'insurance',            emoji: '🛡️' },
  { key: 'other',                emoji: '✏️' },
]

const ALLOWED_MIME = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_FILE_SIZE = 10 * 1024 * 1024

const TANGER_MED_DEFAULT_MAD = 250

interface VehicleOption {
  id: string
  plate_number: string
  brand: string
  model: string
}

export function CaptureReceiptFab({ userRole, companyId }: CaptureReceiptFabProps) {
  const t = useTranslations('accounting')
  const tCommon = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [category, setCategory] = useState<CaptureCategory | null>(null)
  const [amount, setAmount] = useState('')
  const [vehicleId, setVehicleId] = useState<string>('')
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showVehiclePicker = userRole !== 'driver' && userRole !== 'client'

  useEffect(() => {
    if (!open || !showVehiclePicker || !companyId) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('vehicles')
      .select('id, plate_number, brand, model')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('plate_number', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setVehicles(data)
      })
    return () => { cancelled = true }
  }, [open, showVehiclePicker, companyId])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function reset() {
    setFile(null)
    setPreviewUrl(null)
    setCategory(null)
    setAmount('')
    setVehicleId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setOpen(false)
    reset()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_FILE_SIZE) {
      toast.error(t('errors.fileTooLarge'))
      return
    }
    if (!ALLOWED_MIME.split(',').includes(selected.type)) {
      toast.error(t('errors.fileType'))
      return
    }
    setFile(selected)
  }

  function quickFillTangerMed() {
    setCategory('toll_receipt')
    setAmount(String(TANGER_MED_DEFAULT_MAD))
  }

  function quickFillFuel() {
    setCategory('fuel_receipt')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error(t('errors.fileRequired'))
      return
    }
    if (!category) {
      toast.error(t('errors.categoryRequired'))
      return
    }
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('errors.amountRequired'))
      return
    }

    startTransition(async () => {
      const result = await captureAccountingDocument(
        {
          documentCategory: category,
          amountTtc: parsedAmount,
          vehicleId: showVehiclePicker && vehicleId ? vehicleId : null,
        },
        file,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('captured'))
      close()
    })
  }

  if (userRole === 'client') return null
  if (!companyId) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-20 end-4 z-40 flex h-12 items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-br from-rose-600 to-red-700 px-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(225,29,72,0.55)] ring-1 ring-rose-400/30 transition-all hover:scale-[1.02] hover:shadow-[0_14px_36px_-8px_rgba(225,29,72,0.65)] active:scale-95 sm:pe-5 lg:bottom-6"
        aria-label={t('fab.label')}
      >
        {/* Glossy highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/15 to-transparent"
        />
        {/* Subtle pulsing ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/0 transition-all group-hover:ring-white/15"
        />
        <span
          aria-hidden
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 transition-transform group-hover:scale-110 group-active:scale-95"
        >
          <Camera className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={2.4} />
        </span>
        <span className="relative hidden tracking-tight sm:inline">{t('fab.label')}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-card shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">{t('dialog.title')}</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 hover:bg-muted"
                aria-label={tCommon('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {/* Quick buttons (automotive-specific) */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={quickFillTangerMed}
                  className="flex-1 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 active:scale-98 transition"
                >
                  🛣️ {t('quick.tangerMed')}
                </button>
                <button
                  type="button"
                  onClick={quickFillFuel}
                  className="flex-1 rounded-xl border-2 border-blue-300 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-100 active:scale-98 transition"
                >
                  ⛽ {t('quick.fuel')}
                </button>
              </div>

              {/* File picker / preview */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_MIME}
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!file ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition"
                  >
                    <Camera className="h-7 w-7" />
                    <span className="text-sm font-semibold">{t('takePhoto')}</span>
                    <span className="text-xs text-muted-foreground">{t('orPickFile')}</span>
                  </button>
                ) : (
                  <div className="relative overflow-hidden rounded-xl border bg-muted">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="" className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        <FileText className="me-2 h-5 w-5" />
                        {file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute end-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      aria-label={tCommon('clear')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Category grid */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('fields.category')} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((opt) => {
                    const active = category === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCategory(opt.key)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-2.5 text-xs font-medium transition active:scale-98 ${
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="text-xl" aria-hidden="true">{opt.emoji}</span>
                        <span className="text-center leading-tight">{t(`categories.${opt.key}`)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="acc-amount" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('fields.amountTtc')} *
                </label>
                <div className="relative">
                  <input
                    id="acc-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border bg-background px-3 py-3 pe-14 text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    MAD
                  </span>
                </div>
              </div>

              {/* Vehicle (back-office only) */}
              {showVehiclePicker && vehicles.length > 0 && (
                <div>
                  <label htmlFor="acc-vehicle" className="mb-1.5 block text-sm font-medium text-foreground">
                    {t('fields.vehicle')}
                  </label>
                  <select
                    id="acc-vehicle"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{t('fields.vehicleNone')}</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} — {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form>

            <div className="flex shrink-0 gap-2 border-t bg-card p-4">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
