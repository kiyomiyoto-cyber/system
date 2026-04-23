# CLAUDE.md — TMS Logistique

## Project Overview

Transportation Management System for a Moroccan logistics SMB. Multi-tenant SaaS
architecture: one Supabase project serves multiple logistics companies, each fully
isolated via RLS. MVP serves a single tenant; schema is already SaaS-ready.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui ·
Supabase (Postgres + Auth + Storage + Realtime) · Zustand · TanStack Query ·
react-hook-form + zod · Mapbox GL JS · react-pdf · next-intl

**Languages:** French (default) + Arabic (RTL layout)
**Currency:** MAD (Moroccan Dirham)
**Deployment:** Vercel + Supabase Cloud

---

## Absolute Rules — Never Break These

### TypeScript
- Zero `any`. Use `unknown` + type guards, or derive types from generated DB schema.
- All Supabase query results typed via `Database` types (`supabase gen types typescript --local > src/types/database.types.ts`).
- No type assertions (`as Foo`) without an inline comment explaining the invariant.
- `strict: true` in tsconfig. No `noUncheckedIndexedAccess` exceptions.

### Security
- **Every** Supabase table has `ENABLE ROW LEVEL SECURITY`. No exceptions, ever.
- Never trust `company_id` from the request body or URL params. Always derive it
  server-side from the authenticated session via `current_company_id()`.
- Never expose the Supabase service role key to the client. It lives in server-only
  code (`src/lib/supabase/server.ts`). The anon key is safe for browser use.
- All Supabase Storage buckets are **private**. Generate signed URLs server-side
  with short TTLs (≤ 1 hour for POD photos, ≤ 15 min for invoice PDFs).
- File uploads: validate MIME type AND size on the server before writing to Storage.
  Accept only: `image/jpeg`, `image/png`, `image/webp` for photos; `application/pdf`
  for documents. Max size: 10 MB per file.
- Never log PII (names, phones, emails) in production. Log IDs only.

### Multi-tenant Isolation
- Every table (except `companies`) has `company_id uuid NOT NULL`.
- All server-side queries filter by `company_id` even when RLS already enforces it.
  Defense in depth: an application bug should not be the first layer of defense.
- Never `SELECT *` on tenant tables. Always project columns explicitly.
- Never JOIN across companies. If two FKs exist, both must share the same
  `company_id` — enforce this in application code, not just in RLS.
- RLS helper functions live in `supabase/migrations/` — never inline SQL strings
  that duplicate this logic in application code.

### Error Handling
- Server Actions return `{ data: T | null; error: string | null }`. Never throw.
  Let the React layer decide how to surface the error.
- Log errors with structured context: `{ action, userId, companyId, error }`.
- User-facing error messages are always translated strings from i18n files.
  Never surface raw Postgres error messages to users.
- Network failures in React Query hooks: use `retry: 1` globally, not per-hook.

### Code Quality
- No `// TODO` in committed code. Either implement it or create a ticket.
- No commented-out code. Git history is the undo button.
- No hardcoded strings in components — all user-visible text via `useTranslations()`.
- No `console.log` in committed code. Use the structured logger in `src/lib/logger.ts`.

---

## Architecture Decisions

### Roles & Auth

```
super_admin    → manages all companies (Anthropic-style internal admin)
company_admin  → manages one company: settings, users, pricing
dispatcher     → day-to-day ops: shipments, drivers, clients, invoices
driver         → mobile view: sees own shipments, updates status, uploads POD
client         → read-only portal: own shipments + invoices
```

Role + `company_id` are stored in `public.users` (linked to `auth.users`).
After login, the middleware reads the user profile once and injects it into
`requestContext`. Downstream server components and actions call
`getAuthenticatedUser(request)` — one function, one source of truth.

Never read role from the JWT directly in application code — always from the
`public.users` table via the session. JWT claims are only used by RLS policies.

Route group access control:
- `(dashboard)` → `company_admin`, `dispatcher`
- `(driver)` → `driver`
- `(client)` → `client`
- Enforced in `src/app/[locale]/layout.tsx` for each group via middleware.

### Server Actions vs Route Handlers

| Use case | Mechanism |
|----------|-----------|
| Create/update/delete (mutations) | Server Action in `src/actions/` |
| Data fetching in Server Components | Direct Supabase call (server client) |
| Data fetching in Client Components | TanStack Query hook |
| PDF generation | Route Handler `app/api/invoices/[id]/pdf/route.ts` |
| Webhooks (Stripe, etc.) | Route Handler |
| Supabase Edge Functions | For cron jobs (overdue invoices, monthly billing) |

### TanStack Query Conventions

- All client-side SELECT queries go through React Query hooks in `src/hooks/`.
- Query key factory pattern: `shipmentKeys.list(companyId, filters)`.
- `queryClient.invalidateQueries` after every mutation — no manual cache updates
  except for optimistic status updates in the driver flow.
- Global config: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`.

### Optimistic Updates (driver flow only)

When a driver updates a shipment status, optimistically update the local cache
before the server confirms. Roll back on error. This covers:
- `picked_up`, `in_transit`, `delivered`

Do NOT use optimistic updates for financial data (invoices, payments).

### Pricing Engine

File: `src/lib/pricing/calculator.ts`

```
lookup_rates(client_id, company_id, date):
  1. Find active client_pricing_contracts (valid_from ≤ today ≤ valid_to OR valid_to IS NULL)
  2. Fallback: pricing_defaults for the company

price_excl_tax = base_fee + (distance_km × price_per_km)
if is_urgent: price_excl_tax *= (1 + urgency_surcharge_pct / 100)
tax_amount = price_excl_tax × (vat_rate / 100)
price_incl_tax = price_excl_tax + tax_amount
```

Always persist a `pricing_snapshot` JSONB column on the shipment at creation time.
This freezes the rates used — if pricing defaults change later, the shipment price
does not retroactively change.

If `manual_price_override` is set (not null), use it as `price_excl_tax` and
recalculate tax and total. The snapshot still records the calculated price for audit.

### Invoicing Logic

**per_shipment**: When shipment status transitions to `delivered`, a Server Action
creates an invoice immediately. One invoice = one shipment.

**monthly_grouped**: A Supabase Edge Function (cron: `0 8 1 * *` — 1st of month)
groups all `delivered` shipments without an `invoice_id` for each client whose
`billing_mode = 'monthly_grouped'`, creates one invoice per client, and links
them via `invoice_shipments`.

Invoice number format: `{COMPANY_SLUG}-FAC-{YY}-{NNNNN}` (zero-padded, per year).
Shipment reference format: `{COMPANY_SLUG}-EXP-{YY}-{NNNNN}`.
Both use `public.next_sequence_value(company_id, type)` — atomic, no race conditions.

### Realtime Subscriptions

Use Supabase Realtime for:
1. Dispatcher dashboard — live shipment status badge updates
2. Driver app — notification when a shipment is newly assigned

Always filter subscriptions by `company_id`. Always unsubscribe in the cleanup
function of `useEffect`. Do not subscribe to invoice or pricing changes — poll
instead (React Query staleTime handles this).

### Notifications

Abstract interface in `src/lib/notifications/index.ts`:

```typescript
interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>
}
```

Implementations:
- `EmailProvider` → Resend API
- `WhatsappProvider` → stub (logs payload, returns success) until `WHATSAPP_ENABLED=true`

All sends write to the `notifications` table first (status: `pending`), then attempt
delivery. On failure, log `error_message` and increment `attempts`. Max 3 attempts
via cron retry.

### International Shipments

Controlled by `NEXT_PUBLIC_INTERNATIONAL_ENABLED=false` in `.env.local`.

**When false:** Hide all international UI. The schema columns exist but are never
populated. Customs statuses are excluded from dropdowns.

**When true:** Show customs fields on the shipment form. Add `customs_clearance`
to the status workflow. Allow manual price override (distance-based pricing is
unreliable for cross-border routes due to ferries, border delays, etc.).

---

## Folder Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/                   # Public: login only
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # Admin + Dispatcher (desktop-first)
│   │   │   ├── layout.tsx            # sidebar + top nav
│   │   │   ├── dashboard/page.tsx    # KPI overview
│   │   │   ├── shipments/
│   │   │   ├── clients/
│   │   │   ├── drivers/
│   │   │   ├── vehicles/
│   │   │   ├── invoices/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── (driver)/                 # Driver mobile views
│   │   │   ├── layout.tsx
│   │   │   ├── my-shipments/page.tsx
│   │   │   └── delivery/[id]/page.tsx
│   │   └── (client)/                 # Client read-only portal
│   │       ├── layout.tsx
│   │       ├── shipments/page.tsx
│   │       └── invoices/page.tsx
│   └── api/
│       ├── invoices/[id]/pdf/route.ts
│       └── webhooks/route.ts
├── actions/                          # Server Actions by domain
│   ├── shipments.ts
│   ├── drivers.ts
│   ├── clients.ts
│   ├── invoices.ts
│   ├── pricing.ts
│   └── auth.ts
├── components/
│   ├── ui/                           # shadcn/ui (do not modify — re-export only)
│   ├── forms/                        # RHF + zod forms
│   │   ├── shipment-form.tsx
│   │   ├── client-form.tsx
│   │   └── ...
│   ├── maps/                         # Mapbox components
│   │   ├── route-map.tsx
│   │   └── geocoder-input.tsx
│   ├── tables/                       # Data tables (TanStack Table)
│   └── shared/                       # Business UI components
│       ├── shipment-status-badge.tsx
│       ├── shipment-timeline.tsx
│       └── ...
├── hooks/                            # TanStack Query hooks
│   ├── use-shipments.ts
│   ├── use-drivers.ts
│   ├── use-clients.ts
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client (singleton)
│   │   ├── server.ts                 # Server Supabase client (cookies)
│   │   └── middleware.ts             # Auth session refresh
│   ├── pricing/
│   │   └── calculator.ts
│   ├── pdf/
│   │   └── invoice-generator.tsx     # react-pdf document
│   ├── notifications/
│   │   ├── index.ts                  # abstract interface + dispatcher
│   │   ├── email-provider.ts
│   │   └── whatsapp-provider.ts
│   ├── mapbox/
│   │   ├── geocoding.ts              # forward/reverse geocoding
│   │   └── directions.ts            # route distance calculation
│   └── utils/
│       ├── formatters.ts             # currency, date, distance formatters
│       ├── validators.ts             # shared zod schemas
│       └── logger.ts
├── store/                            # Zustand stores
│   ├── auth-store.ts                 # current user, company_id, role
│   └── ui-store.ts                   # sidebar, modal, language state
├── types/
│   ├── database.types.ts             # generated by supabase CLI
│   └── app.types.ts                  # hand-written domain types
└── i18n/
    ├── messages/
    │   ├── fr.json
    │   └── ar.json
    └── config.ts                     # next-intl config

supabase/
├── migrations/
│   └── 20240101000000_initial_schema.sql
└── seed.sql

public/
├── fonts/                            # Arabic-compatible fonts
└── ...
```

---

## Naming Conventions

| Target | Convention | Example |
|--------|-----------|---------|
| Files | `kebab-case` | `shipment-form.tsx` |
| Components | `PascalCase` | `ShipmentStatusBadge` |
| Functions / hooks | `camelCase` | `useShipments`, `createShipment` |
| DB tables / columns | `snake_case` | `assigned_driver_id` |
| Env vars | `SCREAMING_SNAKE_CASE` | `SUPABASE_SERVICE_ROLE_KEY` |
| i18n keys | `dot.nested` | `shipments.status.delivered` |
| Zod schemas | `PascalCase + Schema` | `CreateShipmentSchema` |

---

## i18n Rules

- Every user-visible string goes through `useTranslations()` (client) or
  `getTranslations()` (server). Zero hardcoded French or Arabic in components.
- Arabic locale sets `dir="rtl"` on `<html>`. All layouts use Tailwind logical
  properties: `ms-`, `me-`, `ps-`, `pe-` instead of `ml-`, `mr-`, `pl-`, `pr-`.
  Never add `dir` checks in component logic — CSS handles the flip.
- Currency: `new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount)`
- Dates: `dd/MM/yyyy` for FR; use `Intl.DateTimeFormat` with locale for AR.
- ICU message format for plurals and interpolation. Never string concatenation.
- Arabic strings in `ar.json` must be reviewed by a native speaker before shipping.
  Machine translation is only for dev scaffolding.

---

## Database Conventions

- All PKs: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- All FK `ON DELETE`: always explicit. Usually `RESTRICT` (prevent orphans) or
  `CASCADE` (delete children). `SET NULL` for optional references.
- Soft delete: `deleted_at timestamptz` on all mutable tables. Queries always
  add `WHERE deleted_at IS NULL` unless specifically auditing deleted records.
- All timestamps: `timestamptz` — never `timestamp` (timezone-naive).
- Monetary amounts: `numeric(12,2)` — never `float` or `real` (rounding errors).
- `updated_at` auto-trigger: applied to every table that has an `updated_at` column.
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. One concern
  per migration file. Never alter the schema manually in the Supabase dashboard.
- Generated types: run `supabase gen types typescript --local > src/types/database.types.ts`
  after every migration.

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never in browser bundle

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Notifications
RESEND_API_KEY=                     # email via Resend

# Feature flags
NEXT_PUBLIC_INTERNATIONAL_ENABLED=false
NEXT_PUBLIC_WHATSAPP_ENABLED=false

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Testing Strategy

- No automated tests for MVP (time constraint). Each ticket ships with a manual
  test plan in this format:
  1. Happy path
  2. Validation errors
  3. Authorization check (wrong role → 403)
  4. Edge cases specific to the feature

- Post-MVP: Playwright E2E for: login flow, create shipment, driver delivery + POD,
  generate invoice, mark invoice paid.

- RLS policies: test manually using Supabase Studio's "Auth" emulator with
  different user roles before marking any ticket complete.
