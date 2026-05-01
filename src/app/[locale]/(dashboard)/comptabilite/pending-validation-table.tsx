'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Edit3,
  FileText,
  ImageIcon,
  Loader2,
  X,
  ClipboardList,
} from 'lucide-react'
import {
  validateAccountingDocument,
  rejectAccountingDocument,
  completeAccountingDocument,
  type CompleteAccountingInput,
} from '@/actions/accounting'
import { formatMAD, formatRelativeTime } from '@/lib/utils/formatters'
import type { AccountingDocumentCategory } from '@/types/database.types'

export interface PendingDocViewModel {
  id: string
  documentCategory: AccountingDocumentCategory
  amountTtc: number
  amountHt: number | null
  vatAmount: number | null
  vatRate: number
  supplierName: string | null
  documentDate: string | null
  filePath: string
  fileType: string
  notes: string | null
  capturedAt: string
  capturedByName: string | null
  vehiclePlate: string | null
  driverName: string | null
  thumbnailUrl: string | null
}

interface PendingValidationTableProps {
  rows: PendingDocViewModel[]
  canModerate: boolean
}

export function PendingValidationTable({ rows, canModerate }: PendingValidationTableProps) {
  const t = useTranslations('accounting')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [completingDoc, setCompletingDoc] = useState<PendingDocViewModel | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleValidate(id: string) {
    setPendingId(id)
    startTransition(async () => {
      const result = await validateAccountingDocument(id)
      setPendingId(null)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('actions.validated'))
        router.refresh()
      }
    })
  }

  function submitReject() {
    if (!rejectingId) return
    const id = rejectingId
    setPendingId(id)
    startTransition(async () => {
      const result = await rejectAccountingDocument(id, rejectReason)
      setPendingId(null)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('actions.rejected'))
      setRejectingId(null)
      setRejectReason('')
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-foreground">{t('pending.title')}</h2>
        <span className="ms-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          {t('pending.empty')}
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {doc.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {doc.fileType === 'pdf' ? <FileText className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-semibold text-foreground">
                    {t(`categories.${doc.documentCategory}`)}
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    {formatMAD(doc.amountTtc)}
                  </span>
                  {doc.supplierName && (
                    <span className="text-xs text-muted-foreground">· {doc.supplierName}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('pending.capturedBy', {
                    name: doc.capturedByName ?? t('pending.unknown'),
                    when: formatRelativeTime(doc.capturedAt),
                  })}
                  {doc.vehiclePlate && ` · ${doc.vehiclePlate}`}
                  {doc.driverName && ` · ${doc.driverName}`}
                </p>
              </div>

              {canModerate && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletingDoc(doc)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {t('actions.complete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRejectingId(doc.id); setRejectReason('') }}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t('actions.reject')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidate(doc.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {pendingId === doc.id && isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />
                    }
                    {t('actions.validate')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Reject reason modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t('reject.title')}</h3>
              <button
                type="button"
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className="rounded-full p-1 hover:bg-muted"
                aria-label={tCommon('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">{t('reject.subtitle')}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder={t('reject.placeholder')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={submitReject}
                disabled={isPending || rejectReason.trim().length < 3}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('actions.reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {completingDoc && (
        <CompleteDialog
          doc={completingDoc}
          onClose={() => setCompletingDoc(null)}
          onSaved={() => {
            setCompletingDoc(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

interface CompleteDialogProps {
  doc: PendingDocViewModel
  onClose: () => void
  onSaved: () => void
}

function CompleteDialog({ doc, onClose, onSaved }: CompleteDialogProps) {
  const t = useTranslations('accounting')
  const tCommon = useTranslations('common')
  const [submitting, startTransition] = useTransition()

  const [amountHt, setAmountHt] = useState(doc.amountHt?.toString() ?? '')
  const [vatAmount, setVatAmount] = useState(doc.vatAmount?.toString() ?? '')
  const [vatRate, setVatRate] = useState(String(doc.vatRate))
  const [supplierName, setSupplierName] = useState(doc.supplierName ?? '')
  const [supplierIce, setSupplierIce] = useState('')
  const [documentDate, setDocumentDate] = useState(doc.documentDate ?? '')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState(doc.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CompleteAccountingInput = {
      amountHt: amountHt === '' ? null : Number(amountHt),
      vatAmount: vatAmount === '' ? null : Number(vatAmount),
      vatRate: Number(vatRate),
      supplierName: supplierName.trim() || null,
      supplierIce: supplierIce.trim() || null,
      documentDate: documentDate || null,
      paymentMethod: paymentMethod === '' ? null : (paymentMethod as 'cash' | 'transfer' | 'check' | 'card'),
      notes: notes.trim() || null,
    }
    startTransition(async () => {
      const result = await completeAccountingDocument(doc.id, payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('actions.completed'))
      onSaved()
    })
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">{t('complete.title')}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label={tCommon('close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.amountHt')}</label>
              <input className={inputClass} type="number" step="0.01" min="0" value={amountHt} onChange={(e) => setAmountHt(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.vatRate')}</label>
              <input className={inputClass} type="number" step="0.01" min="0" max="100" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.vatAmount')}</label>
              <input className={inputClass} type="number" step="0.01" min="0" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.supplierName')}</label>
            <input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.supplierIce')}</label>
            <input className={inputClass} value={supplierIce} onChange={(e) => setSupplierIce(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.documentDate')}</label>
              <input className={inputClass} type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.paymentMethod')}</label>
              <select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">—</option>
                <option value="cash">{t('paymentMethods.cash')}</option>
                <option value="transfer">{t('paymentMethods.transfer')}</option>
                <option value="check">{t('paymentMethods.check')}</option>
                <option value="card">{t('paymentMethods.card')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('complete.notes')}</label>
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t bg-card p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
