'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import { logger } from '@/lib/utils/logger'
import type { ActionResult } from '@/types/app.types'
import type { BlFieldType } from '@/types/database.types'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable'] as const
const FIELD_TYPES = ['text', 'number', 'date', 'time', 'textarea', 'select'] as const
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/

interface AuthOk {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
  companyId: string
}
type AuthCheck = AuthOk | { ok: false; error: string }

async function ensureBackOffice(): Promise<AuthCheck> {
  const user = await getAuthenticatedUser()
  if (!user || !user.companyId) return { ok: false, error: 'Non autorisé.' }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false, error: 'Non autorisé.' }
  }
  return { ok: true, user, companyId: user.companyId }
}

// ============================================================
// Template CRUD
// ============================================================

const templateSchema = z.object({
  clientId: z.string().uuid('Client invalide'),
  name: z.string().trim().min(1, 'Nom requis').max(120),
  isDefault: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export type BlTemplateInput = z.input<typeof templateSchema>

export async function createBlTemplate(
  rawInput: BlTemplateInput,
): Promise<ActionResult<{ templateId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  const parsed = templateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', input.clientId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { data: null, error: 'Client introuvable.' }

  if (input.isDefault) {
    await supabase
      .from('bl_templates')
      .update({ is_default: false })
      .eq('client_id', input.clientId)
      .eq('company_id', auth.companyId)
      .eq('is_default', true)
      .is('deleted_at', null)
  }

  const templateId = crypto.randomUUID()
  const { error } = await supabase.from('bl_templates').insert({
    id: templateId,
    company_id: auth.companyId,
    client_id: input.clientId,
    name: input.name,
    is_default: input.isDefault ?? false,
    notes: input.notes ?? null,
    created_by_user_id: auth.user.id,
  })

  if (error) {
    logger.error('bl_template.create_failed', {
      action: 'createBlTemplate',
      userId: auth.user.id,
      companyId: auth.companyId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la création du modèle.' }
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { templateId }, error: null }
}

export async function updateBlTemplate(
  templateId: string,
  rawInput: BlTemplateInput,
): Promise<ActionResult<{ templateId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(templateId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = templateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('bl_templates')
    .select('id, client_id, is_default')
    .eq('id', templateId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Modèle introuvable.' }

  // Becoming default? clear the previous default for this client
  if (input.isDefault && !existing.is_default) {
    await supabase
      .from('bl_templates')
      .update({ is_default: false })
      .eq('client_id', existing.client_id)
      .eq('company_id', auth.companyId)
      .eq('is_default', true)
      .neq('id', templateId)
      .is('deleted_at', null)
  }

  const { error } = await supabase
    .from('bl_templates')
    .update({
      name: input.name,
      is_default: input.isDefault ?? false,
      notes: input.notes ?? null,
    })
    .eq('id', templateId)
    .eq('company_id', auth.companyId)

  if (error) {
    logger.error('bl_template.update_failed', {
      action: 'updateBlTemplate',
      templateId,
      error: error.message,
    })
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath(`/[locale]/(dashboard)/contrats`, 'page')
  return { data: { templateId }, error: null }
}

export async function deleteBlTemplate(
  templateId: string,
): Promise<ActionResult<{ templateId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'company_admin') {
    return { data: null, error: 'Non autorisé.' }
  }

  if (!z.string().uuid().safeParse(templateId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bl_templates')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('id', templateId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { templateId }, error: null }
}

// ============================================================
// Field CRUD
// ============================================================

const fieldSchema = z.object({
  fieldKey: z.string().trim().regex(FIELD_KEY_REGEX, 'Clé invalide (a-z, 0-9, _; commence par une lettre)'),
  label: z.string().trim().min(1, 'Libellé requis').max(120),
  fieldType: z.enum(FIELD_TYPES),
  isRequired: z.boolean().optional().default(false),
  isVisible: z.boolean().optional().default(true),
  placeholder: z.string().trim().max(200).nullable().optional(),
  defaultValue: z.string().trim().max(500).nullable().optional(),
  helpText: z.string().trim().max(500).nullable().optional(),
  selectOptions: z.array(z.string().trim().min(1).max(120)).max(50).optional().default([]),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
})

export type BlFieldInput = z.input<typeof fieldSchema>

export async function addBlField(
  templateId: string,
  rawInput: BlFieldInput,
): Promise<ActionResult<{ fieldId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(templateId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = fieldSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()

  const { data: template } = await supabase
    .from('bl_templates')
    .select('id, client_id')
    .eq('id', templateId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!template) return { data: null, error: 'Modèle introuvable.' }

  if (input.fieldType === 'select' && (input.selectOptions?.length ?? 0) === 0) {
    return { data: null, error: 'Ajoutez au moins une option pour un champ « liste ».' }
  }

  const fieldId = crypto.randomUUID()
  const { error } = await supabase.from('bl_template_fields').insert({
    id: fieldId,
    template_id: templateId,
    company_id: auth.companyId,
    field_key: input.fieldKey,
    label: input.label,
    field_type: input.fieldType as BlFieldType,
    is_required: input.isRequired ?? false,
    is_visible: input.isVisible ?? true,
    placeholder: input.placeholder ?? null,
    default_value: input.defaultValue ?? null,
    help_text: input.helpText ?? null,
    select_options: input.selectOptions ?? [],
    sort_order: input.sortOrder ?? 0,
  })

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Cette clé existe déjà dans ce modèle.' }
    }
    logger.error('bl_field.create_failed', { error: error.message })
    return { data: null, error: 'Échec de l\'ajout du champ.' }
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { fieldId }, error: null }
}

export async function updateBlField(
  fieldId: string,
  rawInput: BlFieldInput,
): Promise<ActionResult<{ fieldId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(fieldId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  const parsed = fieldSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? 'Données invalides.' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('bl_template_fields')
    .select('id, template_id')
    .eq('id', fieldId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (!existing) return { data: null, error: 'Champ introuvable.' }

  if (input.fieldType === 'select' && (input.selectOptions?.length ?? 0) === 0) {
    return { data: null, error: 'Ajoutez au moins une option pour un champ « liste ».' }
  }

  const { error } = await supabase
    .from('bl_template_fields')
    .update({
      field_key: input.fieldKey,
      label: input.label,
      field_type: input.fieldType as BlFieldType,
      is_required: input.isRequired ?? false,
      is_visible: input.isVisible ?? true,
      placeholder: input.placeholder ?? null,
      default_value: input.defaultValue ?? null,
      help_text: input.helpText ?? null,
      select_options: input.selectOptions ?? [],
      sort_order: input.sortOrder ?? 0,
    })
    .eq('id', fieldId)
    .eq('company_id', auth.companyId)

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Cette clé existe déjà dans ce modèle.' }
    }
    return { data: null, error: 'Échec de la mise à jour.' }
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { fieldId }, error: null }
}

export async function deleteBlField(
  fieldId: string,
): Promise<ActionResult<{ fieldId: string }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(fieldId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bl_template_fields')
    .delete()
    .eq('id', fieldId)
    .eq('company_id', auth.companyId)

  if (error) return { data: null, error: 'Échec de la suppression.' }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { fieldId }, error: null }
}

export async function reorderBlFields(
  templateId: string,
  orderedIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }
  if (auth.user.role === 'comptable') return { data: null, error: 'Non autorisé.' }

  if (!z.string().uuid().safeParse(templateId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => !z.string().uuid().safeParse(id).success)) {
    return { data: null, error: 'Liste d\'identifiants invalide.' }
  }

  const supabase = await createClient()
  const { data: template } = await supabase
    .from('bl_templates')
    .select('id')
    .eq('id', templateId)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!template) return { data: null, error: 'Modèle introuvable.' }

  // Sequential updates — list is small (≤ ~20 fields per template).
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    if (!id) continue
    await supabase
      .from('bl_template_fields')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', id)
      .eq('template_id', templateId)
      .eq('company_id', auth.companyId)
  }

  revalidatePath('/[locale]/(dashboard)/contrats', 'page')
  return { data: { count: orderedIds.length }, error: null }
}

// ============================================================
// Read helper — used by future shipment-form integration ticket.
// Returns the default template + visible fields for a client, or null.
// ============================================================
export interface BlTemplateForClient {
  templateId: string
  name: string
  fields: Array<{
    fieldKey: string
    label: string
    fieldType: BlFieldType
    isRequired: boolean
    placeholder: string | null
    defaultValue: string | null
    helpText: string | null
    selectOptions: string[]
    sortOrder: number
  }>
}

export async function getDefaultBlTemplateForClient(
  clientId: string,
): Promise<ActionResult<BlTemplateForClient | null>> {
  const auth = await ensureBackOffice()
  if (!auth.ok) return { data: null, error: auth.error }

  if (!z.string().uuid().safeParse(clientId).success) {
    return { data: null, error: 'Identifiant invalide.' }
  }

  const supabase = await createClient()
  const { data: template } = await supabase
    .from('bl_templates')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('company_id', auth.companyId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!template) return { data: null, error: null }

  const { data: fields } = await supabase
    .from('bl_template_fields')
    .select('field_key, label, field_type, is_required, placeholder, default_value, help_text, select_options, sort_order')
    .eq('template_id', template.id)
    .eq('company_id', auth.companyId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  type FieldRow = {
    field_key: string
    label: string
    field_type: BlFieldType
    is_required: boolean
    placeholder: string | null
    default_value: string | null
    help_text: string | null
    select_options: unknown
    sort_order: number
  }

  return {
    data: {
      templateId: template.id,
      name: template.name,
      fields: ((fields ?? []) as unknown as FieldRow[]).map((f) => ({
        fieldKey: f.field_key,
        label: f.label,
        fieldType: f.field_type,
        isRequired: f.is_required,
        placeholder: f.placeholder,
        defaultValue: f.default_value,
        helpText: f.help_text,
        selectOptions: Array.isArray(f.select_options) ? (f.select_options as string[]) : [],
        sortOrder: f.sort_order,
      })),
    },
    error: null,
  }
}
