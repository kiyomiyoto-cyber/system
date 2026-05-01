'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Edit3,
  Loader2,
  Phone,
  Plus,
  Save,
  Truck,
  Wallet,
  X,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMAD } from '@/lib/utils/formatters'
import {
  recordSupplierPayment,
  upsertSupplier,
  upsertSupplierInvoice,
  type Supplier,
  type SupplierCategory,
  type SupplierInvoice,
} from '@/actions/suppliers'

const CATEGORIES: SupplierCategory[] = [
  'fuel',
  'parts',
  'garage',
  'tires',
  'insurance',
  'telecom',
  'office',
  'cleaning',
  'other',
]

const STATUS_TONE: Record<SupplierInvoice['status'], string> = {
  unpaid: 'bg-amber-50 text-amber-700 ring-amber-200',
  partially_paid: 'bg-blue-50 text-blue-700 ring-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelled: 'bg-slate-100 text-slate-700 ring-slate-200',
}

interface ViewProps {
  suppliers: Supplier[]
  invoices: SupplierInvoice[]
  locale: string
}

type Tab = 'directory' | 'invoices'

export function SuppliersView({ suppliers, invoices, locale }: ViewProps) {
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('directory')
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null)
  const [filterCategory, setFilterCategory] = useState<SupplierCategory | 'all'>('all')

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (s) => filterCategory === 'all' || s.category === filterCategory,
      ),
    [suppliers, filterCategory],
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('directory')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'directory'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.directory', { count: suppliers.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'invoices'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.invoices', { count: invoices.length })}
        </button>
        <div className="ms-auto flex items-center gap-2">
          {tab === 'directory' && (
            <button
              type="button"
              onClick={() => setCreatingSupplier(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-ring"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('actions.newSupplier')}
            </button>
          )}
          {tab === 'invoices' && suppliers.length > 0 && (
            <button
              type="button"
              onClick={() => setCreatingInvoice(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-ring"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('actions.newInvoice')}
            </button>
          )}
        </div>
      </div>

      {tab === 'directory' ? (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-0.5 text-xs">
            {(['all', ...CATEGORIES] as Array<SupplierCategory | 'all'>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  filterCategory === cat
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {cat === 'all' ? tCommon('all') : t(`categories.${cat}`)}
              </button>
            ))}
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              {t('directory.empty')}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSuppliers.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'rounded-xl border bg-card p-4 shadow-soft transition-colors',
                    !s.isActive && 'opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-foreground">{s.name}</h3>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t(`categories.${s.category}`)}
                        {s.city ? ` · ${s.city}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSupplier(s)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
                      aria-label={tCommon('edit')}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {s.contactName && (
                    <p className="mt-2 text-xs text-foreground">{s.contactName}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    {s.contactPhone && (
                      <a href={`tel:${s.contactPhone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="font-mono">{s.contactPhone}</span>
                      </a>
                    )}
                    {s.whatsappPhone && (
                      <a
                        href={`https://wa.me/${s.whatsappPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-emerald-700"
                      >
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {t('directory.invoicesCount', { count: s.invoicesCount })}
                    </span>
                    <span
                      className={cn(
                        'font-semibold',
                        s.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700',
                      )}
                    >
                      {formatMAD(s.outstandingBalance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('invoices.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.number')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.supplier')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.issued')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.due')}
                </th>
                <th className="px-4 py-2.5 text-end text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.total')}
                </th>
                <th className="px-4 py-2.5 text-end text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.balance')}
                </th>
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('invoices.col.status')}
                </th>
                <th className="px-4 py-2.5 text-end text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-2 text-xs">{inv.supplierName}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(inv.issuedAt).toLocaleDateString('fr-MA')}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-MA') : '—'}
                  </td>
                  <td className="px-4 py-2 text-end font-mono text-xs">
                    {formatMAD(inv.totalInclTax)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-end font-mono text-xs font-semibold',
                      inv.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700',
                    )}
                  >
                    {formatMAD(inv.balanceDue)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        STATUS_TONE[inv.status],
                      )}
                    >
                      {t(`invoices.status.${inv.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-end">
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setPayingInvoice(inv)}
                        className="inline-flex items-center gap-1 rounded border bg-card px-2 py-1 text-[10px] font-semibold hover:bg-muted focus-ring"
                      >
                        <Wallet className="h-3 w-3" />
                        {t('actions.recordPayment')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editingSupplier || creatingSupplier) && (
        <SupplierEditorDialog
          supplier={editingSupplier}
          onClose={() => {
            setEditingSupplier(null)
            setCreatingSupplier(false)
          }}
          onSaved={() => {
            setEditingSupplier(null)
            setCreatingSupplier(false)
            router.refresh()
          }}
        />
      )}
      {creatingInvoice && (
        <InvoiceEditorDialog
          suppliers={suppliers}
          onClose={() => setCreatingInvoice(false)}
          onSaved={() => {
            setCreatingInvoice(false)
            router.refresh()
          }}
        />
      )}
      {payingInvoice && (
        <PaymentDialog
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSaved={() => {
            setPayingInvoice(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function SupplierEditorDialog({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('suppliers.editor')
  const tCat = useTranslations('suppliers.categories')
  const tCommon = useTranslations('common')
  const [name, setName] = useState(supplier?.name ?? '')
  const [category, setCategory] = useState<SupplierCategory>(supplier?.category ?? 'fuel')
  const [contactName, setContactName] = useState(supplier?.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(supplier?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(supplier?.contactEmail ?? '')
  const [whatsappPhone, setWhatsappPhone] = useState(supplier?.whatsappPhone ?? '')
  const [city, setCity] = useState(supplier?.city ?? '')
  const [ice, setIce] = useState(supplier?.ice ?? '')
  const [paymentTermsDays, setPaymentTermsDays] = useState(supplier?.paymentTermsDays ?? 30)
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true)
  const [isSaving, startSave] = useTransition()

  const valid = name.trim().length >= 1

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await upsertSupplier({
          id: supplier?.id,
          name: name.trim(),
          category,
          ice: ice.trim() || null,
          contactName: contactName.trim() || null,
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          whatsappPhone: whatsappPhone.trim() || null,
          city: city.trim() || null,
          paymentTermsDays,
          isActive,
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(supplier ? t('toast.updated') : t('toast.created'))
        onSaved()
      })()
    })
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {supplier ? t('titleEdit') : t('titleNew')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.name')}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.category')}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupplierCategory)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.contactName')}>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.contactPhone')}>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                dir="ltr"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.whatsapp')}>
              <input
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                dir="ltr"
              />
            </Field>
            <Field label={t('field.email')}>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('field.city')}>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.ice')}>
              <input
                value={ice}
                onChange={(e) => setIce(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.paymentTerms')}>
              <input
                type="number"
                min={0}
                max={180}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            {t('field.isActive')}
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted focus-ring"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || isSaving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
              valid && !isSaving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceEditorDialog({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('suppliers.invoiceEditor')
  const tCommon = useTranslations('common')
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [totalExclTax, setTotalExclTax] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [isSaving, startSave] = useTransition()

  const valid =
    supplierId &&
    invoiceNumber.trim().length >= 1 &&
    issuedAt &&
    Number(totalExclTax) >= 0 &&
    Number(vatAmount) >= 0

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await upsertSupplierInvoice({
          supplierId,
          invoiceNumber: invoiceNumber.trim(),
          issuedAt,
          dueDate: dueDate || null,
          totalExclTax: Number(totalExclTax),
          vatAmount: Number(vatAmount),
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(t('toast.created'))
        onSaved()
      })()
    })
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-foreground">{t('title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <Field label={t('field.supplier')}>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.invoiceNumber')}>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.issuedAt')}>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
          </div>
          <Field label={t('field.dueDate')}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.totalExclTax')}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={totalExclTax}
                onChange={(e) => setTotalExclTax(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.vatAmount')}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted focus-ring">
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || isSaving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
              valid && !isSaving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: SupplierInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('suppliers.paymentDialog')
  const tCommon = useTranslations('common')
  const [amount, setAmount] = useState(String(invoice.balanceDue))
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>('transfer')
  const [reference, setReference] = useState('')
  const [isSaving, startSave] = useTransition()

  const valid = Number(amount) > 0

  const handleSave = () => {
    if (!valid) return
    startSave(() => {
      void (async () => {
        const res = await recordSupplierPayment({
          supplierInvoiceId: invoice.id,
          amountMad: Number(amount),
          paidAt,
          method,
          reference: reference.trim() || null,
        })
        if (res.error) {
          toast.error(t('toast.failed'), { description: res.error })
          return
        }
        toast.success(t('toast.recorded'))
        onSaved()
      })()
    })
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-soft-lg ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-foreground">{t('title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="font-mono font-semibold text-primary">{invoice.invoiceNumber}</p>
            <p className="mt-0.5 text-muted-foreground">{invoice.supplierName}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">{t('balanceDue')}</span>
              <span className="font-mono font-bold text-amber-700">
                {formatMAD(invoice.balanceDue)}
              </span>
            </div>
          </div>
          <Field label={t('field.amount')}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('field.paidAt')}>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </Field>
            <Field label={t('field.method')}>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="cash">{t('method.cash')}</option>
                <option value="transfer">{t('method.transfer')}</option>
                <option value="check">{t('method.check')}</option>
                <option value="card">{t('method.card')}</option>
              </select>
            </Field>
          </div>
          <Field label={t('field.reference')}>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('field.referencePlaceholder')}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted focus-ring">
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || isSaving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold focus-ring',
              valid && !isSaving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {t('actions.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  )
}
