import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Mail, MessageCircle, Info } from 'lucide-react'
import { getAuthenticatedUser } from '@/actions/auth'
import { PageHeader } from '@/components/shared/page-header'

export default async function NotificationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, user] = await Promise.all([
    getTranslations('settings'),
    getAuthenticatedUser(),
  ])

  if (!user) redirect(`/${locale}/login`)
  if (!['super_admin', 'company_admin'].includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const emailEnabled = !!process.env.RESEND_API_KEY
  const whatsappEnabled = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('notifications')} subtitle={t('notificationsDesc')} />

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 flex gap-3">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{t('notificationsConfigHint')}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{t('email')}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${emailEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {emailEnabled ? t('enabled') : t('disabled')}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('emailDesc')}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">RESEND_API_KEY</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">WhatsApp</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${whatsappEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {whatsappEnabled ? t('enabled') : t('comingSoon')}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('whatsappDesc')}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">NEXT_PUBLIC_WHATSAPP_ENABLED</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
