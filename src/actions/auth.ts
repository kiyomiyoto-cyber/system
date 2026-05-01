'use server'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser, ActionResult } from '@/types/app.types'
import { logger } from '@/lib/utils/logger'

const _getAuthenticatedUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, company_id, role, full_name, email, preferred_language, avatar_url, is_active')
    .eq('id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    companyId: profile.company_id,
    role: profile.role,
    fullName: profile.full_name,
    preferredLanguage: profile.preferred_language,
    avatarUrl: profile.avatar_url,
    isActive: profile.is_active,
  }
})

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  return _getAuthenticatedUser()
}

export async function requireAuth(allowedRoles?: string[]): Promise<AuthUser> {
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect('/fr/login')
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to role-appropriate home
    if (user.role === 'driver') redirect('/fr/my-shipments')
    if (user.role === 'client') redirect('/fr/portal/shipments')
    if (user.role === 'external_accountant') redirect('/fr/accountant/dossiers')
    redirect('/fr/login')
  }

  return user
}

export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult<{ role: string; locale: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    logger.warn('Login failed', { action: 'signIn', error: error.message })
    return { data: null, error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, preferred_language, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile) {
    return { data: null, error: 'Profil utilisateur introuvable. Contactez votre administrateur.' }
  }

  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { data: null, error: 'Ce compte est désactivé. Contactez votre administrateur.' }
  }

  // Fire-and-forget — don't make the user wait for this round-trip.
  void supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)

  logger.info('User signed in', { action: 'signIn', userId: data.user.id })

  return {
    data: {
      role: profile.role,
      locale: profile.preferred_language,
    },
    error: null,
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/fr/login')
}

export async function createCompanyUser(payload: {
  email: string
  fullName: string
  role: 'dispatcher' | 'driver' | 'client'
  phone?: string
  companyId: string
  preferredLanguage?: 'fr' | 'ar'
}): Promise<ActionResult<{ userId: string }>> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceClient()

  // Create auth user with invite
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: payload.email,
    email_confirm: true,
    user_metadata: { full_name: payload.fullName },
  })

  if (authError || !authData.user) {
    logger.error('Failed to create auth user', { action: 'createCompanyUser', error: authError?.message })
    return { data: null, error: authError?.message ?? 'Erreur lors de la création du compte.' }
  }

  // Insert profile
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    company_id: payload.companyId,
    role: payload.role,
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone ?? null,
    preferred_language: payload.preferredLanguage ?? 'fr',
  })

  if (profileError) {
    // Roll back auth user
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { data: null, error: profileError.message }
  }

  // Send password reset link (acts as invitation)
  await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: payload.email,
  })

  return { data: { userId: authData.user.id }, error: null }
}

export async function deactivateUser(userId: string, companyId: string): Promise<ActionResult> {
  const me = await getAuthenticatedUser()
  if (!me || me.role !== 'company_admin' || me.companyId !== companyId) {
    return { data: null, error: 'Non autorisé.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', userId)
    .eq('company_id', companyId)

  if (error) return { data: null, error: error.message }
  return { data: null, error: null }
}
