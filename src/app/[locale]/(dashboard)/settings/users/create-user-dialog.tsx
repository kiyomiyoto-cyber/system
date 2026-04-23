'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { createUser } from '@/actions/users'

const Schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['company_admin', 'dispatcher', 'driver', 'client']),
  password: z.string().min(8),
})

type FormData = z.infer<typeof Schema>

export function CreateUserDialog() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { fullName: '', email: '', phone: '', role: 'dispatcher', password: '' },
  })

  async function onSubmit(data: FormData) {
    setSubmitting(true)
    const result = await createUser(data)
    if (result.success) {
      toast.success(t('userCreated'))
      setOpen(false)
      form.reset()
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {t('addUser')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{t('addUser')}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className={labelClass}>{t('fullName')} *</label>
                <input className={inputClass} {...form.register('fullName')} />
              </div>
              <div>
                <label className={labelClass}>{tCommon('email')} *</label>
                <input className={inputClass} type="email" {...form.register('email')} />
              </div>
              <div>
                <label className={labelClass}>{t('phone')}</label>
                <input className={inputClass} {...form.register('phone')} />
              </div>
              <div>
                <label className={labelClass}>{t('role')} *</label>
                <select className={inputClass} {...form.register('role')}>
                  <option value="dispatcher">{t('role.dispatcher')}</option>
                  <option value="company_admin">{t('role.company_admin')}</option>
                  <option value="driver">{t('role.driver')}</option>
                  <option value="client">{t('role.client')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('initialPassword')} *</label>
                <input className={inputClass} type="text" {...form.register('password')} />
                <p className="mt-1 text-xs text-muted-foreground">{t('passwordHint')}</p>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tCommon('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
