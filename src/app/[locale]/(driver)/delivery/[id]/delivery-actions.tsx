'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Camera, PenTool, CheckCircle, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { updateShipmentStatus } from '@/actions/shipments'
import { uploadPODPhoto, uploadSignature } from '@/actions/pod'
import type { ShipmentStatus } from '@/types/database.types'

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as unknown as React.ComponentType<{
  ref?: React.Ref<{ clear: () => void; isEmpty: () => boolean; getTrimmedCanvas: () => HTMLCanvasElement }>
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>
  penColor?: string
  backgroundColor?: string
}>

interface DeliveryActionsProps {
  shipmentId: string
  status: ShipmentStatus
}

export function DeliveryActions({ shipmentId, status }: DeliveryActionsProps) {
  const t = useTranslations('shipments')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signedByName, setSignedByName] = useState('')
  const [uploading, setUploading] = useState(false)
  const sigRef = useRef<{ clear: () => void; isEmpty: () => boolean; getTrimmedCanvas: () => HTMLCanvasElement } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleStatusUpdate(newStatus: ShipmentStatus) {
    startTransition(async () => {
      const result = await updateShipmentStatus(shipmentId, newStatus)
      if (result.success) {
        toast.success(t('statusUpdated'))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const result = await uploadPODPhoto(shipmentId, file)
    setUploading(false)
    if (result.success) {
      toast.success(t('photoUploaded'))
      router.refresh()
    } else {
      toast.error(result.error)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSignatureSubmit() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error(t('signatureRequired'))
      return
    }
    if (!signedByName.trim()) {
      toast.error(t('signedByNameRequired'))
      return
    }
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    setUploading(true)
    const result = await uploadSignature(shipmentId, dataUrl, signedByName.trim())
    setUploading(false)
    if (result.success) {
      toast.success(t('signatureSaved'))
      setShowSignatureModal(false)
      setSignedByName('')
      handleStatusUpdate('delivered')
    } else {
      toast.error(result.error)
    }
  }

  if (status === 'delivered' || status === 'cancelled' || status === 'failed') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
        <p className="text-sm font-medium text-green-800">{t(`status.${status}`)}</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3 pt-2">
        {status === 'assigned' && (
          <button
            onClick={() => handleStatusUpdate('picked_up')}
            disabled={isPending}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-98"
          >
            {isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('markPickedUp')}
          </button>
        )}

        {status === 'picked_up' && (
          <button
            onClick={() => handleStatusUpdate('in_transit')}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('markInTransit')}
          </button>
        )}

        {status === 'in_transit' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              {t('uploadPhoto')}
            </button>

            <button
              onClick={() => setShowSignatureModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <PenTool className="h-5 w-5" />
              {t('captureSignature')}
            </button>

            <button
              onClick={() => handleStatusUpdate('failed')}
              disabled={isPending}
              className="w-full rounded-xl border border-destructive/30 bg-background px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              {t('markFailed')}
            </button>
          </>
        )}
      </div>

      {/* Signature modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t('captureSignature')}</h3>
              <button onClick={() => setShowSignatureModal(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
              placeholder={t('recipientName')}
              className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="rounded-lg border bg-white">
              <SignatureCanvas
                ref={sigRef}
                penColor="#000"
                backgroundColor="#fff"
                canvasProps={{ className: 'w-full h-48 rounded-lg' }}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => sigRef.current?.clear()}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                {tCommon('clear')}
              </button>
              <button
                onClick={handleSignatureSubmit}
                disabled={uploading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('confirmDelivery')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
