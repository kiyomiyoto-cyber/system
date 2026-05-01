import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { MessageCircle } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import {
  WhatsappTemplatesView,
  type TemplateRow,
  type SendLogRow,
} from './whatsapp-templates-view'

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'dispatcher', 'comptable']
const WRITE_ROLES = ['super_admin', 'company_admin', 'dispatcher']

export default async function WhatsappPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('whatsapp.page'),
    getLocale(),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!ALLOWED_ROLES.includes(user.role)) redirect(`/${locale}/dashboard`)
  if (!user.companyId) redirect(`/${locale}/dashboard`)
  const companyId = user.companyId

  const supabase = await createClient()

  const [templatesRes, sendLogRes] = await Promise.all([
    supabase
      .from('whatsapp_templates')
      .select('id, key, name, audience, body, is_active, updated_at')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('audience', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('whatsapp_send_log')
      .select(
        'id, template_key, audience, recipient_phone, recipient_name, body_rendered, sent_at, sent_by_user_id, shipment_id, sent_by:users!whatsapp_send_log_sent_by_user_id_fkey(full_name)',
      )
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })
      .limit(100),
  ])

  type TemplateRaw = {
    id: string
    key: string
    name: string
    audience: 'driver' | 'client' | 'subcontractor' | 'internal'
    body: string
    is_active: boolean
    updated_at: string
  }
  type SendLogRaw = {
    id: string
    template_key: string | null
    audience: 'driver' | 'client' | 'subcontractor' | 'internal'
    recipient_phone: string
    recipient_name: string | null
    body_rendered: string
    sent_at: string
    shipment_id: string | null
    sent_by: { full_name: string } | null
  }

  const templates: TemplateRow[] = ((templatesRes.data ?? []) as unknown as TemplateRaw[]).map(
    (t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      audience: t.audience,
      body: t.body,
      isActive: t.is_active,
      updatedAt: t.updated_at,
    }),
  )

  const sendLog: SendLogRow[] = ((sendLogRes.data ?? []) as unknown as SendLogRaw[]).map(
    (r) => ({
      id: r.id,
      templateKey: r.template_key,
      audience: r.audience,
      recipientPhone: r.recipient_phone,
      recipientName: r.recipient_name,
      bodyRendered: r.body_rendered,
      sentAt: r.sent_at,
      shipmentId: r.shipment_id,
      sentByName: r.sent_by?.full_name ?? null,
    }),
  )

  const canEdit = WRITE_ROLES.includes(user.role)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <MessageCircle className="h-3.5 w-3.5" />
            {t('templateCount', { count: templates.filter((t) => t.isActive).length })}
          </span>
        }
      />
      <WhatsappTemplatesView
        templates={templates}
        sendLog={sendLog}
        canEdit={canEdit}
        locale={locale}
      />
    </div>
  )
}
