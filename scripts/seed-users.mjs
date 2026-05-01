// One-shot script: creates demo auth users + links them to public.users.
// Usage: node scripts/seed-users.mjs
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const PASSWORD = 'Demo1234!'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const users = [
  // Super admin is attached to the demo company in this single-tenant MVP
  // so dashboard pages (which guard on companyId) render. In a real multi-
  // tenant prod setup, super_admin would impersonate a tenant via UI.
  { email: 'superadmin@demo-tms.ma', role: 'super_admin',   full_name: 'Super Admin',      company_id: COMPANY_ID },
  { email: 'admin@demo-tms.ma',      role: 'company_admin', full_name: 'Admin Demo',       company_id: COMPANY_ID },
  { email: 'dispatcher@demo-tms.ma', role: 'dispatcher',    full_name: 'Dispatcher Demo',  company_id: COMPANY_ID },
  { email: 'driver@demo-tms.ma',     role: 'driver',        full_name: 'Driver Demo',      company_id: COMPANY_ID },
  { email: 'client@demo-tms.ma',     role: 'client',        full_name: 'Client Demo',      company_id: COMPANY_ID },
]

async function findAuthUserId(email) {
  // listUsers is paginated; for our tiny seed this is fine.
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email === email)
    if (match) return match.id
    if (data.users.length < 200) return null
    page++
  }
}

async function ensureAuthUser({ email }) {
  const existing = await findAuthUserId(email)
  if (existing) {
    console.log(`  auth user already exists: ${email}`)
    return existing
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  console.log(`  created auth user: ${email}`)
  return data.user.id
}

async function ensureProfile({ id, email, role, full_name, company_id }) {
  const { error } = await admin.from('users').upsert(
    {
      id,
      company_id,
      role,
      full_name,
      email,
      is_active: true,
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`upsert public.users(${email}): ${error.message}`)
  console.log(`  linked profile: ${email} (${role})`)
}

async function main() {
  console.log('Seeding demo users…')
  for (const u of users) {
    console.log(`- ${u.email}`)
    const id = await ensureAuthUser(u)
    await ensureProfile({ ...u, id })
  }
  console.log('\nDone. Login with any email above + password: ' + PASSWORD)
}

main().catch((e) => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
