'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'

const READ_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const

const SUPPLIER_CATEGORIES = [
  'fuel',
  'parts',
  'garage',
  'tires',
  'insurance',
  'telecom',
  'office',
  'cleaning',
  'other',
] as const
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number]

export interface Supplier {
  id: string
  name: string
  category: SupplierCategory
  ice: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  whatsappPhone: string | null
  city: string | null
  paymentTermsDays: number
  isActive: boolean
  outstandingBalance: number
  invoicesCount: number
}

export interface SupplierInvoice {
  id: string
  supplierId: string
  supplierName: string
  invoiceNumber: string
  issuedAt: string
  dueDate: string | null
  totalExclTax: number
  vatAmount: number
  totalInclTax: number
  amountPaid: number
  balanceDue: number
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
}

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}

async function ensureWriter(): Promise<AuthOk | { ok: false; error: string }> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

async function ensureReader(): Promise<AuthOk | { ok: false; error: string }> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!READ_ROLES.includes(user.role as (typeof READ_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

// ============================================================
// List suppliers + outstanding balance per supplier
// ============================================================
export async function listSuppliers(): Promise<ActionResult<Supplier[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()

  const [suppliersRes, invoicesRes] = await Promise.all([
    supabase
      .from('suppliers')
      .select(
        'id, name, category, ice, contact_name, contact_phone, contact_email, whatsapp_phone, city, payment_terms_days, is_active',
      )
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('supplier_invoices')
      .select('supplier_id, balance_due')
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .neq('status', 'cancelled'),
  ])

  if (suppliersRes.error) {
    return { data: null, error: suppliersRes.error.message }
  }

  type Row = {
    id: string
    name: string
    category: SupplierCategory
    ice: string | null
    contact_name: string | null
    contact_phone: string | null
    contact_email: string | null
    whatsapp_phone: string | null
    city: string | null
    payment_terms_days: number
    is_active: boolean
  }
  type InvRow = { supplier_id: string; balance_due: number | string | null }

  const balanceBySupplier = new Map<string, { balance: number; count: number }>()
  for (const r of (invoicesRes.data ?? []) as unknown as InvRow[]) {
    const cur = balanceBySupplier.get(r.supplier_id) ?? { balance: 0, count: 0 }
    cur.balance += Number(r.balance_due ?? 0)
    cur.count += 1
    balanceBySupplier.set(r.supplier_id, cur)
  }

  const rows = (suppliersRes.data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      ice: r.ice,
      contactName: r.contact_name,
      contactPhone: r.contact_phone,
      contactEmail: r.contact_email,
      whatsappPhone: r.whatsapp_phone,
      city: r.city,
      paymentTermsDays: r.payment_terms_days,
      isActive: r.is_active,
      outstandingBalance: balanceBySupplier.get(r.id)?.balance ?? 0,
      invoicesCount: balanceBySupplier.get(r.id)?.count ?? 0,
    })),
    error: null,
  }
}

// ============================================================
// List supplier invoices (filterable by supplier or status)
// ============================================================
export async function listSupplierInvoices(opts?: {
  supplierId?: string
  status?: SupplierInvoice['status']
  limit?: number
}): Promise<ActionResult<SupplierInvoice[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()

  let query = supabase
    .from('supplier_invoices')
    .select(
      'id, supplier_id, invoice_number, issued_at, due_date, total_excl_tax, vat_amount, total_incl_tax, amount_paid, balance_due, status, supplier:suppliers(name)',
    )
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('issued_at', { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.supplierId) query = query.eq('supplier_id', opts.supplierId)
  if (opts?.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    supplier_id: string
    invoice_number: string
    issued_at: string
    due_date: string | null
    total_excl_tax: number | string
    vat_amount: number | string
    total_incl_tax: number | string
    amount_paid: number | string
    balance_due: number | string
    status: SupplierInvoice['status']
    supplier: { name: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      supplierName: r.supplier?.name ?? '—',
      invoiceNumber: r.invoice_number,
      issuedAt: r.issued_at,
      dueDate: r.due_date,
      totalExclTax: Number(r.total_excl_tax),
      vatAmount: Number(r.vat_amount),
      totalInclTax: Number(r.total_incl_tax),
      amountPaid: Number(r.amount_paid),
      balanceDue: Number(r.balance_due),
      status: r.status,
    })),
    error: null,
  }
}

// ============================================================
// Upsert supplier
// ============================================================
const upsertSupplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  category: z.enum(SUPPLIER_CATEGORIES),
  ice: z.string().trim().max(40).nullable().optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  contactEmail: z.string().trim().max(200).email().nullable().optional().or(z.literal('').transform(() => null)),
  whatsappPhone: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  paymentTermsDays: z.number().int().min(0).max(180),
  isActive: z.boolean(),
})

export type UpsertSupplierInput = z.input<typeof upsertSupplierSchema>

export async function upsertSupplier(
  rawInput: UpsertSupplierInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = upsertSupplierSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const i = parsed.data
  const supabase = await createClient()

  if (i.id) {
    const { data: before } = await supabase
      .from('suppliers')
      .select('id, name, category, ice, contact_name, contact_phone, contact_email, whatsapp_phone, city, payment_terms_days, is_active')
      .eq('id', i.id)
      .eq('company_id', auth.companyId)
      .maybeSingle()
    if (!before) return { data: null, error: 'Fournisseur introuvable.' }

    const { error } = await supabase
      .from('suppliers')
      .update({
        name: i.name,
        category: i.category,
        ice: i.ice ?? null,
        contact_name: i.contactName ?? null,
        contact_phone: i.contactPhone ?? null,
        contact_email: i.contactEmail ?? null,
        whatsapp_phone: i.whatsappPhone ?? null,
        city: i.city ?? null,
        payment_terms_days: i.paymentTermsDays,
        is_active: i.isActive,
      })
      .eq('id', i.id)
      .eq('company_id', auth.companyId)
    if (error) return { data: null, error: error.message }

    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'supplier',
      entityId: i.id,
      action: 'update',
      beforeState: before as Record<string, unknown>,
      afterState: {
        ...i,
      },
      actor: {
        userId: auth.user.id,
        role: auth.user.role,
        name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
      },
    })

    revalidatePath('/dashboard/fournisseurs')
    return { data: { id: i.id, created: false }, error: null }
  }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      company_id: auth.companyId,
      name: i.name,
      category: i.category,
      ice: i.ice ?? null,
      contact_name: i.contactName ?? null,
      contact_phone: i.contactPhone ?? null,
      contact_email: i.contactEmail ?? null,
      whatsapp_phone: i.whatsappPhone ?? null,
      city: i.city ?? null,
      payment_terms_days: i.paymentTermsDays,
      is_active: i.isActive,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Échec.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'supplier',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...i },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })

  revalidatePath('/dashboard/fournisseurs')
  return { data: { id: data.id, created: true }, error: null }
}

// ============================================================
// Create a supplier invoice
// ============================================================
const upsertInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(120),
  issuedAt: z.string(),
  dueDate: z.string().nullable().optional(),
  totalExclTax: z.number().min(0),
  vatAmount: z.number().min(0),
  notes: z.string().trim().max(2000).nullable().optional(),
  accountingDocumentId: z.string().uuid().nullable().optional(),
})

export type UpsertSupplierInvoiceInput = z.input<typeof upsertInvoiceSchema>

export async function upsertSupplierInvoice(
  rawInput: UpsertSupplierInvoiceInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = upsertInvoiceSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const i = parsed.data
  const supabase = await createClient()

  if (i.id) {
    const { error } = await supabase
      .from('supplier_invoices')
      .update({
        supplier_id: i.supplierId,
        invoice_number: i.invoiceNumber,
        issued_at: i.issuedAt,
        due_date: i.dueDate ?? null,
        total_excl_tax: i.totalExclTax,
        vat_amount: i.vatAmount,
        notes: i.notes ?? null,
        accounting_document_id: i.accountingDocumentId ?? null,
      })
      .eq('id', i.id)
      .eq('company_id', auth.companyId)
    if (error) {
      return {
        data: null,
        error: error.code === '23505' ? 'Cette référence existe déjà.' : error.message,
      }
    }
    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'supplier_invoice',
      entityId: i.id,
      action: 'update',
      afterState: { ...i },
      actor: {
        userId: auth.user.id,
        role: auth.user.role,
        name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
      },
    })
    revalidatePath('/dashboard/fournisseurs')
    return { data: { id: i.id, created: false }, error: null }
  }

  const { data, error } = await supabase
    .from('supplier_invoices')
    .insert({
      company_id: auth.companyId,
      supplier_id: i.supplierId,
      invoice_number: i.invoiceNumber,
      issued_at: i.issuedAt,
      due_date: i.dueDate ?? null,
      total_excl_tax: i.totalExclTax,
      vat_amount: i.vatAmount,
      notes: i.notes ?? null,
      accounting_document_id: i.accountingDocumentId ?? null,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    return {
      data: null,
      error: error?.code === '23505' ? 'Cette référence existe déjà.' : (error?.message ?? 'Échec.'),
    }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'supplier_invoice',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...i },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })
  revalidatePath('/dashboard/fournisseurs')
  return { data: { id: data.id, created: true }, error: null }
}

// ============================================================
// Record a payment against a supplier invoice
// ============================================================
const recordPaymentSchema = z.object({
  supplierInvoiceId: z.string().uuid(),
  amountMad: z.number().positive(),
  paidAt: z.string(),
  method: z.enum(['cash', 'transfer', 'check', 'card']),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function recordSupplierPayment(
  rawInput: z.input<typeof recordPaymentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = recordPaymentSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const p = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('supplier_payments')
    .insert({
      company_id: auth.companyId,
      supplier_invoice_id: p.supplierInvoiceId,
      amount_mad: p.amountMad,
      paid_at: p.paidAt,
      method: p.method,
      reference: p.reference ?? null,
      notes: p.notes ?? null,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Échec.' }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'supplier_payment',
    entityId: data.id,
    action: 'create',
    afterState: { id: data.id, ...p },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })
  revalidatePath('/dashboard/fournisseurs')
  return { data: { id: data.id }, error: null }
}
