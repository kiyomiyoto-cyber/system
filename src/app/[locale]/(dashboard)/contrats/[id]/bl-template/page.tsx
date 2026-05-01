import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import type { BlFieldType } from '@/types/database.types'
import {
  BlTemplateManager,
  type BlTemplateViewModel,
  type BlFieldViewModel,
} from './bl-template-manager'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']

interface ContractRow {
  id: string
  client_id: string
  client: { id: string; business_name: string } | null
}

interface TemplateRow {
  id: string
  name: string
  is_default: boolean
  notes: string | null
}

interface FieldRow {
  id: string
  template_id: string
  field_key: string
  label: string
  field_type: BlFieldType
  is_required: boolean
  is_visible: boolean
  placeholder: string | null
  default_value: string | null
  help_text: string | null
  select_options: unknown
  sort_order: number
}

export default async function ContractBlTemplatePage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations('blTemplates'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)

  const supabase = await createClient()

  const { data: contractData } = await supabase
    .from('client_contracts')
    .select('id, client_id, client:clients(id, business_name)')
    .eq('id', params.id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  const contract = contractData as unknown as ContractRow | null
  if (!contract || !contract.client) notFound()

  const { data: templatesData } = await supabase
    .from('bl_templates')
    .select('id, name, is_default, notes')
    .eq('client_id', contract.client_id)
    .eq('company_id', user.companyId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const templates = ((templatesData ?? []) as unknown as TemplateRow[])

  let fields: FieldRow[] = []
  if (templates.length > 0) {
    const { data: fieldsData } = await supabase
      .from('bl_template_fields')
      .select('id, template_id, field_key, label, field_type, is_required, is_visible, placeholder, default_value, help_text, select_options, sort_order')
      .in('template_id', templates.map((tpl) => tpl.id))
      .eq('company_id', user.companyId)
      .order('sort_order', { ascending: true })
    fields = ((fieldsData ?? []) as unknown as FieldRow[])
  }

  const fieldsByTemplate = new Map<string, BlFieldViewModel[]>()
  for (const f of fields) {
    const list = fieldsByTemplate.get(f.template_id) ?? []
    list.push({
      id: f.id,
      fieldKey: f.field_key,
      label: f.label,
      fieldType: f.field_type,
      isRequired: f.is_required,
      isVisible: f.is_visible,
      placeholder: f.placeholder,
      defaultValue: f.default_value,
      helpText: f.help_text,
      selectOptions: Array.isArray(f.select_options) ? (f.select_options as string[]) : [],
      sortOrder: f.sort_order,
    })
    fieldsByTemplate.set(f.template_id, list)
  }

  const templateVms: BlTemplateViewModel[] = templates.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    isDefault: tpl.is_default,
    notes: tpl.notes,
    fields: fieldsByTemplate.get(tpl.id) ?? [],
  }))

  const canEdit = user.role !== 'comptable'

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/contrats/${contract.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t('page.backToContract')}
      </Link>

      <PageHeader
        title={t('page.title', { client: contract.client.business_name })}
        description={t('page.subtitle')}
      />

      <BlTemplateManager
        clientId={contract.client_id}
        clientName={contract.client.business_name}
        templates={templateVms}
        canEdit={canEdit}
      />
    </div>
  )
}
