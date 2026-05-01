'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { recordAccountingAudit } from '@/lib/accounting/audit'
import { logger } from '@/lib/utils/logger'
import { formatMAD } from '@/lib/utils/formatters'
import type { ActionResult } from '@/types/app.types'

const READ_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher'] as const

export type WhatsappAudience = 'driver' | 'client' | 'subcontractor' | 'internal'

export interface WhatsappTemplate {
  id: string
  companyId: string
  key: string
  name: string
  audience: WhatsappAudience
  body: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}
type AuthCheck = AuthOk | { ok: false; error: string }

async function ensureReader(): Promise<AuthCheck> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!READ_ROLES.includes(user.role as (typeof READ_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

async function ensureWriter(): Promise<AuthCheck> {
  const auth = await ensureReader()
  if (!auth.ok) return auth
  if (!WRITE_ROLES.includes(auth.user.role as (typeof WRITE_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return auth
}

// ============================================================
// List templates (filtered by audience optionally).
// ============================================================
export async function listWhatsappTemplates(
  audience?: WhatsappAudience,
): Promise<ActionResult<WhatsappTemplate[]>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  const supabase = await createClient()
  let query = supabase
    .from('whatsapp_templates')
    .select('id, company_id, key, name, audience, body, is_active, created_at, updated_at')
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('audience', { ascending: true })
    .order('name', { ascending: true })

  if (audience) {
    query = query.eq('audience', audience)
  }

  const { data, error } = await query
  if (error) {
    logger.error('whatsapp.list_templates_failed', {
      action: 'listWhatsappTemplates',
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: error.message }
  }

  type Row = {
    id: string
    company_id: string
    key: string
    name: string
    audience: WhatsappAudience
    body: string
    is_active: boolean
    created_at: string
    updated_at: string
  }
  const rows = (data ?? []) as unknown as Row[]
  return {
    data: rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      key: r.key,
      name: r.name,
      audience: r.audience,
      body: r.body,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    error: null,
  }
}

// ============================================================
// Render a template against a context.
// Returns the resolved phone, recipient name, and final body.
// The {context} is built server-side by joining the related records,
// so the client never injects raw values into the rendered body.
// ============================================================
export type RenderContextKind =
  | { kind: 'shipment'; shipmentId: string; audience: WhatsappAudience }
  | { kind: 'invoice'; invoiceId: string; audience: 'client' }
  | { kind: 'subcontracted_mission'; missionId: string; audience: 'subcontractor' }
  | { kind: 'free'; audience: WhatsappAudience; phone: string; recipientName?: string }

export interface RenderedTemplate {
  templateId: string | null
  templateKey: string | null
  audience: WhatsappAudience
  recipientPhone: string | null
  recipientName: string | null
  body: string
  variables: Record<string, string>
  shipmentId: string | null
  clientId: string | null
  driverId: string | null
  subcontractorId: string | null
}

const HAS_PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function renderBody(body: string, vars: Record<string, string>): string {
  return body.replace(HAS_PLACEHOLDER, (_m, key: string) => {
    const v = vars[key]
    return v == null || v === '' ? `{{${key}}}` : v
  })
}

function firstNameOf(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0] ?? ''
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export async function renderWhatsappMessage(
  templateId: string | null,
  customBody: string | null,
  context: RenderContextKind,
): Promise<ActionResult<RenderedTemplate>> {
  const auth = await ensureReader()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!templateId && !customBody) {
    return { data: null, error: 'Template ou message libre requis.' }
  }

  const supabase = await createClient()

  // Resolve template if provided
  let template: { id: string; key: string; body: string; audience: WhatsappAudience } | null = null
  if (templateId) {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('id, key, body, audience')
      .eq('id', templateId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !data) return { data: null, error: error?.message ?? 'Modèle introuvable.' }
    template = {
      id: data.id,
      key: data.key,
      body: data.body,
      audience: data.audience as WhatsappAudience,
    }
  }

  const baseBody = customBody?.trim() ? customBody : (template?.body ?? '')
  if (!baseBody) return { data: null, error: 'Corps du message vide.' }

  // Build the variable map from the context.
  const vars: Record<string, string> = {}
  let recipientPhone: string | null = null
  let recipientName: string | null = null
  let shipmentId: string | null = null
  let clientId: string | null = null
  let driverId: string | null = null
  let subcontractorId: string | null = null

  // Always include the company name for branding.
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .maybeSingle()
  vars.company_name = company?.name ?? ''

  if (context.kind === 'shipment') {
    const { data: ship, error } = await supabase
      .from('shipments')
      .select(
        'id, reference, pickup_city, delivery_city, pickup_scheduled_at, delivery_scheduled_at, client_id, assigned_driver_id, client:clients(id, business_name, contact_name, contact_phone, whatsapp_phone), driver:drivers(id, full_name, phone, whatsapp_phone), vehicle:vehicles(plate_number)',
      )
      .eq('id', context.shipmentId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !ship) return { data: null, error: error?.message ?? 'Mission introuvable.' }
    type ShipRow = {
      id: string
      reference: string
      pickup_city: string
      delivery_city: string
      pickup_scheduled_at: string | null
      delivery_scheduled_at: string | null
      client_id: string | null
      assigned_driver_id: string | null
      client: {
        id: string
        business_name: string
        contact_name: string | null
        contact_phone: string
        whatsapp_phone: string | null
      } | null
      driver: {
        id: string
        full_name: string
        phone: string
        whatsapp_phone: string | null
      } | null
      vehicle: { plate_number: string } | null
    }
    const s = ship as unknown as ShipRow
    shipmentId = s.id
    clientId = s.client?.id ?? null
    driverId = s.driver?.id ?? null

    vars.shipment_ref = s.reference
    vars.pickup_city = s.pickup_city
    vars.delivery_city = s.delivery_city
    vars.pickup_time = formatDateTime(s.pickup_scheduled_at)
    vars.delivery_time = formatDateTime(s.delivery_scheduled_at)
    vars.client_name = s.client?.business_name ?? ''
    vars.client_contact = s.client?.contact_name ?? s.client?.business_name ?? ''
    vars.driver_name = s.driver?.full_name ?? ''
    vars.driver_first_name = firstNameOf(s.driver?.full_name)
    vars.vehicle_plate = s.vehicle?.plate_number ?? ''

    if (context.audience === 'driver' && s.driver) {
      recipientPhone = s.driver.whatsapp_phone ?? s.driver.phone
      recipientName = s.driver.full_name
    } else if (context.audience === 'client' && s.client) {
      recipientPhone = s.client.whatsapp_phone ?? s.client.contact_phone
      recipientName = s.client.contact_name ?? s.client.business_name
    }
  } else if (context.kind === 'invoice') {
    const { data: inv, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, total_incl_tax, due_date, client_id, client:clients(id, business_name, contact_name, contact_phone, whatsapp_phone)',
      )
      .eq('id', context.invoiceId)
      .eq('company_id', auth.companyId)
      .maybeSingle()
    if (error || !inv) return { data: null, error: error?.message ?? 'Facture introuvable.' }
    type InvRow = {
      id: string
      invoice_number: string
      total_incl_tax: number | string
      due_date: string | null
      client_id: string | null
      client: {
        id: string
        business_name: string
        contact_name: string | null
        contact_phone: string
        whatsapp_phone: string | null
      } | null
    }
    const i = inv as unknown as InvRow
    clientId = i.client?.id ?? null

    vars.invoice_number = i.invoice_number
    vars.invoice_amount = formatMAD(Number(i.total_incl_tax ?? 0))
    vars.invoice_due_date = i.due_date
      ? new Date(i.due_date).toLocaleDateString('fr-MA')
      : ''
    vars.client_name = i.client?.business_name ?? ''
    vars.client_contact = i.client?.contact_name ?? i.client?.business_name ?? ''

    if (i.client) {
      recipientPhone = i.client.whatsapp_phone ?? i.client.contact_phone
      recipientName = i.client.contact_name ?? i.client.business_name
    }
  } else if (context.kind === 'subcontracted_mission') {
    const { data: m, error } = await supabase
      .from('subcontracted_missions')
      .select(
        'id, mission_order_number, cost_excl_tax, subcontractor_id, shipment:shipments(reference, pickup_city, delivery_city, pickup_scheduled_at), subcontractor:subcontractors(id, name, contact_name, phone, whatsapp_phone)',
      )
      .eq('id', context.missionId)
      .eq('company_id', auth.companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !m) {
      return { data: null, error: error?.message ?? 'Mission sous-traitée introuvable.' }
    }
    type MissionRow = {
      id: string
      mission_order_number: string
      cost_excl_tax: number | string
      subcontractor_id: string | null
      shipment: {
        reference: string
        pickup_city: string
        delivery_city: string
        pickup_scheduled_at: string | null
      } | null
      subcontractor: {
        id: string
        name: string
        contact_name: string | null
        phone: string | null
        whatsapp_phone: string | null
      } | null
    }
    const r = m as unknown as MissionRow
    subcontractorId = r.subcontractor?.id ?? null

    vars.mission_order_ref = r.mission_order_number
    vars.cost = formatMAD(Number(r.cost_excl_tax ?? 0))
    vars.pickup_city = r.shipment?.pickup_city ?? ''
    vars.delivery_city = r.shipment?.delivery_city ?? ''
    vars.pickup_time = formatDateTime(r.shipment?.pickup_scheduled_at ?? null)
    vars.subcontractor_contact = r.subcontractor?.contact_name ?? r.subcontractor?.name ?? ''

    if (r.subcontractor) {
      recipientPhone = r.subcontractor.whatsapp_phone ?? r.subcontractor.phone ?? null
      recipientName = r.subcontractor.contact_name ?? r.subcontractor.name
    }
  } else if (context.kind === 'free') {
    recipientPhone = context.phone
    recipientName = context.recipientName ?? null
  }

  const renderedBody = renderBody(baseBody, vars)

  return {
    data: {
      templateId: template?.id ?? null,
      templateKey: template?.key ?? null,
      audience: context.audience,
      recipientPhone,
      recipientName,
      body: renderedBody,
      variables: vars,
      shipmentId,
      clientId,
      driverId,
      subcontractorId,
    },
    error: null,
  }
}

// ============================================================
// Record a send (after the user has clicked through to wa.me).
// We cannot confirm receipt — we record intent + edited body so the
// audit trail reflects what actually went out.
// ============================================================
const recordSendSchema = z.object({
  templateId: z.string().uuid().nullable(),
  templateKey: z.string().nullable().optional(),
  audience: z.enum(['driver', 'client', 'subcontractor', 'internal']),
  recipientPhone: z.string().min(4).max(40),
  recipientName: z.string().nullable().optional(),
  bodyRendered: z.string().min(1).max(4000),
  shipmentId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  driverId: z.string().uuid().nullable().optional(),
  subcontractorId: z.string().uuid().nullable().optional(),
})

export type RecordSendInput = z.input<typeof recordSendSchema>

export async function recordWhatsappSend(
  rawInput: RecordSendInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = recordSendSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_send_log')
    .insert({
      company_id: auth.companyId,
      template_id: input.templateId,
      template_key: input.templateKey ?? null,
      audience: input.audience,
      recipient_phone: input.recipientPhone,
      recipient_name: input.recipientName ?? null,
      body_rendered: input.bodyRendered,
      shipment_id: input.shipmentId ?? null,
      client_id: input.clientId ?? null,
      driver_id: input.driverId ?? null,
      subcontractor_id: input.subcontractorId ?? null,
      sent_by_user_id: auth.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('whatsapp.record_send_failed', {
      action: 'recordWhatsappSend',
      companyId: auth.companyId,
      error: error?.message,
    })
    return { data: null, error: error?.message ?? 'Échec enregistrement.' }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'whatsapp_send',
    entityId: data.id,
    action: 'send',
    afterState: {
      audience: input.audience,
      recipient_phone: input.recipientPhone,
      template_key: input.templateKey ?? null,
      shipment_id: input.shipmentId ?? null,
    },
    notes: input.templateKey ? `Modèle : ${input.templateKey}` : 'Message libre',
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })

  return { data: { id: data.id }, error: null }
}

// ============================================================
// CRUD on templates (back-office only).
// ============================================================
const upsertTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Clé invalide (a-z, 0-9, _ uniquement).'),
  name: z.string().trim().min(1).max(120),
  audience: z.enum(['driver', 'client', 'subcontractor', 'internal']),
  body: z.string().trim().min(1).max(4000),
  isActive: z.boolean(),
})

export type UpsertTemplateInput = z.input<typeof upsertTemplateSchema>

export async function upsertWhatsappTemplate(
  rawInput: UpsertTemplateInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }

  const parsed = upsertTemplateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data
  const supabase = await createClient()

  if (input.id) {
    // Update — fetch before to record audit diff
    const { data: before } = await supabase
      .from('whatsapp_templates')
      .select('id, key, name, audience, body, is_active')
      .eq('id', input.id)
      .eq('company_id', auth.companyId)
      .maybeSingle()
    if (!before) return { data: null, error: 'Modèle introuvable.' }

    const { error } = await supabase
      .from('whatsapp_templates')
      .update({
        key: input.key,
        name: input.name,
        audience: input.audience,
        body: input.body,
        is_active: input.isActive,
      })
      .eq('id', input.id)
      .eq('company_id', auth.companyId)

    if (error) {
      return {
        data: null,
        error: error.code === '23505' ? 'Cette clé existe déjà.' : error.message,
      }
    }

    await recordAccountingAudit({
      companyId: auth.companyId,
      entityType: 'whatsapp_template',
      entityId: input.id,
      action: 'update',
      beforeState: before as Record<string, unknown>,
      afterState: {
        id: input.id,
        key: input.key,
        name: input.name,
        audience: input.audience,
        body: input.body,
        is_active: input.isActive,
      },
      actor: {
        userId: auth.user.id,
        role: auth.user.role,
        name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
      },
    })

    revalidatePath('/dashboard/whatsapp')
    return { data: { id: input.id, created: false }, error: null }
  }

  // Insert
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .insert({
      company_id: auth.companyId,
      key: input.key,
      name: input.name,
      audience: input.audience,
      body: input.body,
      is_active: input.isActive,
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      data: null,
      error: error?.code === '23505' ? 'Cette clé existe déjà.' : (error?.message ?? 'Échec.'),
    }
  }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'whatsapp_template',
    entityId: data.id,
    action: 'create',
    afterState: {
      id: data.id,
      key: input.key,
      name: input.name,
      audience: input.audience,
      body: input.body,
      is_active: input.isActive,
    },
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })

  revalidatePath('/dashboard/whatsapp')
  return { data: { id: data.id, created: true }, error: null }
}

export async function deleteWhatsappTemplate(
  templateId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await ensureWriter()
  if (!auth.ok) return { data: null, error: auth.error }
  if (!z.string().uuid().safeParse(templateId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('whatsapp_templates')
    .select('id, key, name, audience, body, is_active')
    .eq('id', templateId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!before) return { data: null, error: 'Modèle introuvable.' }

  const { error } = await supabase
    .from('whatsapp_templates')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', templateId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: error.message }

  await recordAccountingAudit({
    companyId: auth.companyId,
    entityType: 'whatsapp_template',
    entityId: templateId,
    action: 'delete',
    beforeState: before as Record<string, unknown>,
    actor: {
      userId: auth.user.id,
      role: auth.user.role,
      name: auth.user.fullName ?? auth.user.email ?? 'utilisateur',
    },
  })

  revalidatePath('/dashboard/whatsapp')
  return { data: { id: templateId }, error: null }
}

// `buildWaMeUrl` lives in src/lib/whatsapp/url.ts because 'use server' files
// can only export async functions.
