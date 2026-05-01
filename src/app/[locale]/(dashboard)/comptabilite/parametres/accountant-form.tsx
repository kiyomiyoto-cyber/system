'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { setAccountantProfile } from '@/actions/monthly-dossiers'
import type { AccountantDeliveryMethod } from '@/types/database.types'

interface AccountantFormProps {
  initialProfile: {
    accountant_name: string
    cabinet_name: string | null
    email: string | null
    phone: string | null
    whatsapp_phone: string | null
    preferred_delivery_method: AccountantDeliveryMethod
    billing_terms: string | null
    notes: string | null
  } | null
}

export function AccountantForm({ initialProfile }: AccountantFormProps) {
  const t = useTranslations('accounting')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [accountantName, setAccountantName] = useState(initialProfile?.accountant_name ?? '')
  const [cabinetName, setCabinetName] = useState(initialProfile?.cabinet_name ?? '')
  const [email, setEmail] = useState(initialProfile?.email ?? '')
  const [phone, setPhone] = useState(initialProfile?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(initialProfile?.whatsapp_phone ?? '')
  const [method, setMethod] = useState<AccountantDeliveryMethod>(initialProfile?.preferred_delivery_method ?? 'email')
  const [billingTerms, setBillingTerms] = useState(initialProfile?.billing_terms ?? '')
  const [notes, setNotes] = useState(initialProfile?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (accountantName.trim().length < 2) {
      toast.error(t('settings.nameRequired'))
      return
    }
    startTransition(async () => {
      const result = await setAccountantProfile({
        accountantName: accountantName.trim(),
        cabinetName: cabinetName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        whatsappPhone: whatsapp.trim() || null,
        preferredDeliveryMethod: method,
        billingTerms: billingTerms.trim() || null,
        notes: notes.trim() || null,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('settings.saved'))
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.accountantName')} *</label>
          <input className={inputClass} value={accountantName} onChange={(e) => setAccountantName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.cabinetName')}</label>
          <input className={inputClass} value={cabinetName} onChange={(e) => setCabinetName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.email')}</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.fields.emailHint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.phone')}</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.whatsapp')}</label>
          <input className={inputClass} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.method')}</label>
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as AccountantDeliveryMethod)}>
            <option value="email">{t('dossiers.method.email')}</option>
            <option value="usb">{t('dossiers.method.usb')}</option>
            <option value="paper">{t('dossiers.method.paper')}</option>
            <option value="portal">{t('dossiers.method.portal')}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.billingTerms')}</label>
        <input className={inputClass} value={billingTerms} onChange={(e) => setBillingTerms(e.target.value)} placeholder={t('settings.fields.billingTermsPlaceholder')} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">{t('settings.fields.notes')}</label>
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
