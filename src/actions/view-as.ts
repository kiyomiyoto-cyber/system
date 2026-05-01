'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/actions/auth'

const COOKIE_NAME = 'tms_view_as'
const VIEW_AS_ROLES = ['dispatcher', 'comptable'] as const
const ADMIN_ROLES = ['super_admin', 'company_admin'] as const

export type ViewAsRole = (typeof VIEW_AS_ROLES)[number]

function isViewAsRole(value: string | undefined): value is ViewAsRole {
  return !!value && (VIEW_AS_ROLES as readonly string[]).includes(value)
}

// Returns the impersonated role from the cookie, or null. Only meaningful when
// the real user is an admin — callers must gate on that themselves.
export async function getViewAsRole(): Promise<ViewAsRole | null> {
  const store = await cookies()
  const value = store.get(COOKIE_NAME)?.value
  return isViewAsRole(value) ? value : null
}

export async function setViewAsRole(role: ViewAsRole, locale: string): Promise<void> {
  const user = await getAuthenticatedUser()
  if (!user) redirect(`/${locale}/login`)
  if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) {
    redirect(`/${locale}/dashboard`)
  }
  if (!isViewAsRole(role)) redirect(`/${locale}/dashboard`)

  const store = await cookies()
  store.set(COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  // Land on each role's primary workspace.
  const target = role === 'dispatcher' ? 'shipments' : 'comptabilite'
  redirect(`/${locale}/${target}`)
}

export async function clearViewAsRole(locale: string): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
  redirect(`/${locale}/dashboard`)
}
