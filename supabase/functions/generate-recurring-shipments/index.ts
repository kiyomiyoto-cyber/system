// Edge Function — generate-recurring-shipments
//
// Cron entry-point that, for every active company, calls
// public.generate_recurring_shipments(company_id, next_monday, next_sunday).
//
// Schedule (set in supabase/config.toml or via the dashboard):
//   cron = "0 18 * * FRI"   # Every Friday 18:00 UTC
// Africa/Casablanca = UTC+1 (DST observed via IANA), so 18:00 UTC ≈ 19:00 local.
// If you want exactly 18:00 local, run "0 17 * * FRI" outside DST or wire
// the schedule through a TZ-aware scheduler (Vercel cron supports TZ).
//
// Idempotency: the SQL function deduplicates per (schedule_id, day) via a
// partial unique index — re-running the cron is safe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function nextWeekWindow(now: Date): { start: string; end: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  const start = new Date(d)
  start.setUTCDate(start.getUTCDate() + (8 - dow))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

Deno.serve(async (req) => {
  // Optional shared secret check so the function can also be hit manually
  // without exposing the generator publicly.
  const expected = Deno.env.get('CRON_SECRET')
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  const window = nextWeekWindow(new Date())

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)
    .eq('is_active', true)

  if (companiesError) {
    return new Response(
      JSON.stringify({ error: 'companies_fetch_failed', details: companiesError.message }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const results: Array<{ companyId: string; inserted: number; error?: string }> = []
  for (const c of companies ?? []) {
    const { data, error } = await supabase.rpc('generate_recurring_shipments', {
      p_company_id: c.id,
      p_window_start: window.start,
      p_window_end: window.end,
    })
    results.push({
      companyId: c.id,
      inserted: typeof data === 'number' ? data : 0,
      ...(error ? { error: error.message } : {}),
    })
  }

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
  return new Response(
    JSON.stringify({ window, totalInserted, results }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
