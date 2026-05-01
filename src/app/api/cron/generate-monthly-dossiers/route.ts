import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateMonthlyDossierAsSystem } from '@/actions/monthly-dossiers'
import { logger } from '@/lib/utils/logger'

// Vercel Cron: scheduled in vercel.json — `0 8 1 * *` (1st of month, 08:00 UTC).
// Generates the monthly recap dossier for every active tenant for the
// just-finished month. Idempotent: re-running on the same month upserts the
// existing dossier (status reset to 'ready').
//
// Auth: Bearer token equal to CRON_SECRET. Vercel automatically attaches this
// header for crons declared in vercel.json. Manual triggers must pass it too.

export const dynamic = 'force-dynamic'
// PDF rendering for many tenants can run long — give the route headroom.
export const maxDuration = 300

interface PerTenantResult {
  companyId: string
  companyName: string | null
  ok: boolean
  dossierId?: string
  error?: string
}

function previousMonthIso(now: Date = new Date()): string {
  // Returns YYYY-MM-01 for the month BEFORE `now`, in UTC.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 10)
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  if (!auth) return false
  return auth === `Bearer ${secret}`
}

async function runCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const periodOverride = url.searchParams.get('period') // YYYY-MM-01 for backfill / testing
  const period =
    periodOverride && /^\d{4}-\d{2}-01$/.test(periodOverride)
      ? periodOverride
      : previousMonthIso()

  const startedAt = Date.now()
  const service = await createServiceClient()

  // Fetch every active tenant. Service client bypasses RLS — necessary because
  // the cron runs without a session.
  const { data: companies, error: companiesError } = await service
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)

  if (companiesError) {
    logger.error('cron.dossiers.fetch_companies_failed', {
      action: 'generate-monthly-dossiers',
      error: companiesError.message,
    })
    return NextResponse.json(
      { error: 'Failed to list tenants', detail: companiesError.message },
      { status: 500 },
    )
  }

  const results: PerTenantResult[] = []

  // Sequential — generation includes PDF rendering and Storage upload, both
  // memory-hungry. Parallelism here risks exhausting the Vercel function.
  for (const company of companies ?? []) {
    try {
      const r = await generateMonthlyDossierAsSystem(company.id, period)
      if (r.data) {
        results.push({
          companyId: company.id,
          companyName: company.name ?? null,
          ok: true,
          dossierId: r.data.dossierId,
        })
      } else {
        logger.warn('cron.dossiers.tenant_failed', {
          companyId: company.id,
          period,
          error: r.error,
        })
        results.push({
          companyId: company.id,
          companyName: company.name ?? null,
          ok: false,
          error: r.error,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('cron.dossiers.tenant_threw', {
        companyId: company.id,
        period,
        error: message,
      })
      results.push({
        companyId: company.id,
        companyName: company.name ?? null,
        ok: false,
        error: message,
      })
    }
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.length - ok
  const elapsedMs = Date.now() - startedAt

  logger.info('cron.dossiers.completed', {
    action: 'generate-monthly-dossiers',
    period,
    tenantsTotal: results.length,
    tenantsOk: ok,
    tenantsFailed: failed,
    elapsedMs,
  })

  return NextResponse.json({
    period,
    tenantsTotal: results.length,
    tenantsOk: ok,
    tenantsFailed: failed,
    elapsedMs,
    results,
  })
}

export async function GET(req: Request) {
  return runCron(req)
}

export async function POST(req: Request) {
  return runCron(req)
}
