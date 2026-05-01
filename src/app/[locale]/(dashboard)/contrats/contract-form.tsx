'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { createContract, updateContract, type ContractInput } from '@/actions/client-contracts'
import type { ClientContractStatus, ClientContractBillingMode } from '@/types/database.types'

interface ContractFormProps {
  mode: 'create' | 'edit'
  contractId?: string
  clients: Array<{ id: string; business_name: string }>
  initial?: {
    clientId: string
    contractNumber: string | null
    signedDate: string | null
    startDate: string
    endDate: string | null
    paymentTermsDays: number
    billingMode: ClientContractBillingMode
    autoRenewal: boolean
    status: ClientContractStatus
    notes: string | null
  }
}

export function ContractForm({ mode, contractId, clients, initial }: ContractFormProps) {
  const t = useTranslations('contracts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const params = useParams() as { locale: string }
  const [isPending, startTransition] = useTransition()

  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? '')
  const [contractNumber, setContractNumber] = useState(initial?.contractNumber ?? '')
  const [signedDate, setSignedDate] = useState(initial?.signedDate ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [paymentTerms, setPaymentTerms] = useState(String(initial?.paymentTermsDays ?? 30))
  const [billingMode, setBillingMode] = useState<ClientContractBillingMode>(initial?.billingMode ?? 'per_shipment')
  const [autoRenewal, setAutoRenewal] = useState(initial?.autoRenewal ?? false)
  const [status, setStatus] = useState<ClientContractStatus>(initial?.status ?? 'draft')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) {
      toast.error(t('form.clientRequired'))
      return
    }
    const payload: ContractInput = {
      clientId,
      contractNumber: contractNumber.trim() || null,
      signedDate: signedDate || null,
      startDate,
      endDate: endDate || null,
      paymentTermsDays: Number(paymentTerms),
      billingMode,
      autoRenewal,
      status,
      notes: notes.trim() || null,
    }
    startTransition(async () => {
      const result = mode === 'create'
        ? await createContract(payload)
        : await updateContract(contractId!, payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(mode === 'create' ? t('form.created') : t('form.updated'))
      if (mode === 'create' && result.data?.contractId) {
        router.push(`/${params.locale}/contrats/${result.data.contractId}`)
      } else {
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.client')} *</label>
          <select
            className={inputClass}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={mode === 'edit'}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.contractNumber')}</label>
          <input className={inputClass} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.startDate')} *</label>
          <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.endDate')}</label>
          <input className={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{t('form.endDateHint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.signedDate')}</label>
          <input className={inputClass} type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.paymentTerms')}</label>
          <select className={inputClass} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
            <option value="0">{t('form.immediate')}</option>
            <option value="15">15 {tCommon('days')}</option>
            <option value="30">30 {tCommon('days')}</option>
            <option value="45">45 {tCommon('days')}</option>
            <option value="60">60 {tCommon('days')}</option>
            <option value="90">90 {tCommon('days')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.billingMode')}</label>
          <select className={inputClass} value={billingMode} onChange={(e) => setBillingMode(e.target.value as ClientContractBillingMode)}>
            <option value="per_shipment">{t('billing.per_shipment')}</option>
            <option value="monthly_grouped">{t('billing.monthly_grouped')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('form.status')}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ClientContractStatus)}>
            <option value="draft">{t('status.draft')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="expired">{t('status.expired')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoRenewal}
          onChange={(e) => setAutoRenewal(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span>{t('form.autoRenewal')}</span>
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">{t('form.notes')}</label>
        <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {tCommon('save')}
        </button>
      </div>
    </form>
  )
}
