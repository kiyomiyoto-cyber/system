# TMS Logistique — Implementation Tickets

Ordered by execution priority. Each ticket is atomic and shippable independently
(within its phase). Dependencies listed explicitly.

Legend: `depends: [T0.2]` means this ticket cannot start before T0.2 is merged.

---

## Phase 0 — Foundation (no dependencies within phase, but all subsequent phases depend on these)

### T0.1 · Project Initialization
**What:** Bootstrap the Next.js project with all dependencies installed and configured.

**Deliverables:**
- `npx create-next-app@14 --typescript --tailwind --app --src-dir --import-alias "@/*"`
- Install dependencies: `@supabase/supabase-js @supabase/ssr zustand @tanstack/react-query react-hook-form zod @hookform/resolvers mapbox-gl @mapbox/mapbox-gl-geocoder react-pdf next-intl date-fns resend`
- Install shadcn/ui: `npx shadcn@latest init`
- Add shadcn components: `button input label select textarea dialog sheet badge card table tabs skeleton avatar dropdown-menu`
- Configure `tsconfig.json`: strict mode, path aliases
- Configure `next.config.ts`: i18n disabled (handled by next-intl), image domains (Supabase Storage URL)
- Configure `tailwind.config.ts`: RTL-compatible, add Arabic font (IBM Plex Arabic or Noto Naskh Arabic)
- Set up `.env.example` with all required variables (no values)

**Test:** `npm run build` passes with zero TypeScript errors.

---

### T0.2 · Supabase Project Setup + Schema Migration
**What:** Create Supabase project and execute the full database schema.

**Deliverables:**
- Create Supabase project in dashboard (or `supabase init` + `supabase start` for local dev)
- Paste and execute `docs/schema.sql` in Supabase SQL Editor
- Run `supabase gen types typescript --local > src/types/database.types.ts`
- Verify all 16 tables exist with RLS enabled
- Create Storage buckets: `pod-documents`, `invoice-pdfs`, `customs-docs`, `avatars` (all private)
- Test RLS helper functions: `SELECT public.current_user_role()` returns null for anon

**Test:** All tables visible in Table Editor. `\dt` in SQL Editor shows expected tables.

---

### T0.3 · next-intl Setup (FR + AR + RTL)
**What:** Configure next-intl for French/Arabic routing with full RTL layout flip.
**Depends:** T0.1

**Deliverables:**
- `src/i18n/config.ts`: `locales: ['fr', 'ar']`, `defaultLocale: 'fr'`
- `src/i18n/request.ts`: `getRequestConfig()` loading messages from `messages/[locale].json`
- Root `middleware.ts`: next-intl `createMiddleware()` + Supabase `updateSession()` composed
- `src/app/[locale]/layout.tsx`: sets `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`
- Scaffold `messages/fr.json` and `messages/ar.json` with all top-level namespaces (empty strings OK for now)
- `src/components/shared/language-switcher.tsx`: button toggles FR↔AR, persists in cookie

**Test:** Navigate to `/ar/login` → `<html dir="rtl">` is set. Navigate to `/fr/login` → `dir="ltr"`.

---

### T0.4 · Supabase Auth Integration + Route Protection
**What:** Wire up Supabase auth with role-based route guards.
**Depends:** T0.1, T0.2

**Deliverables:**
- `src/lib/supabase/client.ts`: `createBrowserClient()` singleton
- `src/lib/supabase/server.ts`: `createServerClient()` + `createServiceClient()` (service role)
- `src/lib/supabase/middleware.ts`: `updateSession()` for cookie refresh
- `src/actions/auth.ts`: `getAuthenticatedUser()` — fetches user + profile in one call; redirects to login if unauthenticated
- `src/store/auth-store.ts`: Zustand store for `{ user, profile, companyId, role }`
- Route group layouts enforce access:
  - `(dashboard)/layout.tsx` → allows `company_admin`, `dispatcher`; redirects others
  - `(driver)/layout.tsx` → allows `driver` only
  - `(client)/layout.tsx` → allows `client` only

**Test:**
1. Unauthenticated user → any protected route → redirected to login
2. Driver user → `/dashboard` → redirected to `/my-shipments`
3. Client user → `/drivers` → redirected to their portal

---

### T0.5 · Base Layout Components
**What:** Dispatcher dashboard layout (sidebar + topbar) and driver/client minimal layouts.
**Depends:** T0.1, T0.3, T0.4

**Deliverables:**
- `(dashboard)/layout.tsx`: collapsible sidebar (desktop), slide-out drawer (mobile), topbar with user avatar + language switcher
- Sidebar nav items: Dashboard, Shipments, Clients, Drivers, Vehicles, Invoices, Reports, Settings
- `(driver)/layout.tsx`: fixed bottom tab bar (mobile) — My Shipments, Profile
- `(client)/layout.tsx`: minimal top header — My Shipments, My Invoices
- `src/components/shared/page-header.tsx`
- `src/components/shared/user-nav.tsx` (avatar dropdown: profile, logout)
- All sidebar labels through `useTranslations('nav')` — both FR and AR keys populated

**Test:** Sidebar collapses on mobile breakpoint. RTL: sidebar appears on the right in Arabic layout.

---

### T0.6 · TanStack Query + Zustand Setup
**What:** Configure global React Query client and Zustand auth store initialization.
**Depends:** T0.1, T0.4

**Deliverables:**
- `src/app/[locale]/layout.tsx` wraps with `<QueryClientProvider>`
- Global React Query config: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`
- `src/store/auth-store.ts`: `useAuthStore()` with `setUser()`, `clearUser()`
- Auth store hydration: after login, server action returns profile; client stores in Zustand
- `src/lib/utils/formatters.ts`: `formatMAD()`, `formatDate()`, `formatDistance()`

**Test:** React Query DevTools visible in dev mode. Auth store persists across page navigations.

---

## Phase 1 — Authentication & User Management

### T1.1 · Login Page
**What:** Email/password login with role-based redirect.
**Depends:** T0.3, T0.4, T0.5

**Deliverables:**
- `(auth)/login/page.tsx`: login form with email + password
- Form validation with zod: email format, min password length
- On success: read role from profile → redirect:
  - `company_admin` / `dispatcher` → `/{locale}/dashboard`
  - `driver` → `/{locale}/my-shipments`
  - `client` → `/{locale}/shipments`
- Loading state on submit button
- Error messages translated: wrong credentials, account inactive

**Test:**
1. Login with valid dispatcher credentials → redirect to dashboard
2. Login with wrong password → inline error message (no page reload)
3. Inactive account → "Compte désactivé" error

---

### T1.2 · User Management (Admin)
**What:** Admin can create and manage company users (dispatcher, driver, client accounts).
**Depends:** T0.4, T0.5, T0.6

**Deliverables:**
- `settings/users/page.tsx`: list all company users with role badge + active status
- `settings/users/new/page.tsx`: create user form
  - Fields: full_name, email, role (dropdown: dispatcher/driver/client), phone, preferred_language
  - Server action: `createUser()` — calls `supabase.auth.admin.createUser()` via service role, then inserts into `public.users`
  - Sends Supabase magic link / invite email automatically
- Deactivate user: toggle `is_active` (does not delete auth user)
- Password reset: button triggers `supabase.auth.admin.generateLink()` and sends email

**Test:**
1. Create dispatcher user → receives invite email → can log in → redirected to dashboard
2. Deactivate driver → driver tries to log in → sees "Compte inactif" error
3. Dispatcher cannot access `/settings/users` (admin only)

---

## Phase 2 — Client & Driver Management

### T2.1 · Client CRUD
**What:** Full create/read/update/deactivate cycle for B2B clients.
**Depends:** T0.5, T0.6, T1.2

**Deliverables:**
- `clients/page.tsx`: paginated table (business_name, city, billing_mode, payment_terms, active shipments count)
- `clients/new/page.tsx`: create form with all fields
- `clients/[id]/page.tsx`: client detail — info + recent shipments + invoices + pricing contract
- `clients/[id]/edit/page.tsx`
- `src/hooks/use-clients.ts`: `useClients()`, `useClient(id)`
- `src/actions/clients.ts`: `createClient()`, `updateClient()`, `deactivateClient()`
- If creating with portal access: calls `createUser()` with role `'client'`, then links `clients.user_id`

**Test:**
1. Create client → appears in list → detail page shows correct info
2. Edit billing_mode → reflected in invoice generation logic
3. Client user logs in → can only see their own client record via RLS

---

### T2.2 · Driver CRUD + Performance View
**What:** Full CRUD for drivers with performance stats display.
**Depends:** T0.5, T0.6, T1.2

**Deliverables:**
- `drivers/page.tsx`: table with availability toggle, stats preview (deliveries, rating, on-time rate)
- `drivers/new/page.tsx`: form with all fields including license/CIN expiry
- `drivers/[id]/page.tsx`: profile + stats + current vehicle + recent deliveries
- `drivers/[id]/edit/page.tsx`
- Availability toggle: calls `toggleAvailability()` server action (optimistic update)
- Expiry alerts: if license_expiry or cin_expiry within 30 days → amber badge on list + detail

**Test:**
1. Create driver → assign to a vehicle → appears as available
2. Driver logs in → can only see their own profile (RLS)
3. Toggle availability → updates immediately (optimistic), confirmed on server response

---

### T2.3 · Vehicle CRUD + Driver Assignment
**What:** Fleet management with driver assignment history.
**Depends:** T2.2

**Deliverables:**
- `vehicles/page.tsx`: table with type, plate, assigned driver (if any), expiry alerts
- `vehicles/new/page.tsx`: vehicle form
- `vehicles/[id]/page.tsx`: vehicle detail + current driver + maintenance log
- Assign driver: select driver from available drivers dropdown → inserts `driver_vehicle_assignments` row, closes previous assignment
- Unassign driver: sets `unassigned_at = now()`
- `src/components/shared/vehicle-expiry-alert.tsx`: shows insurance/registration expiry warnings

**Test:**
1. Assign driver to vehicle → driver's profile shows this vehicle; previous vehicle loses assignment
2. Vehicle with expired insurance → red badge in list

---

## Phase 3 — Pricing Engine

### T3.1 · Default Pricing Settings UI
**What:** Admin can configure company-wide default pricing.
**Depends:** T0.5, T0.2

**Deliverables:**
- `settings/pricing/page.tsx`: form showing current defaults (base_fee, price_per_km, urgency_surcharge_pct, urgency_threshold_hours, vat_rate)
- Live price preview: input a distance → shows calculated price in real time (client-side calculation)
- Save via `updatePricingDefaults()` server action
- `src/lib/pricing/calculator.ts`: `calculatePrice({ rates, distanceKm, isUrgent })` → `{ priceExclTax, taxAmount, priceInclTax }`

**Test:**
1. Change base_fee to 150 → save → create new shipment → price uses new rate
2. Existing shipment prices NOT affected (pricing_snapshot is immutable)

---

### T3.2 · Client Pricing Contracts
**What:** Dispatcher can create/edit custom pricing contracts per client.
**Depends:** T3.1, T2.1

**Deliverables:**
- `clients/[id]/page.tsx`: add "Contrats tarifaires" section showing active + past contracts
- `src/components/forms/pricing-contract-form.tsx`: create/edit contract (base_fee, price_per_km, valid_from, valid_to, notes)
- `src/actions/pricing.ts`: `createPricingContract()`, `deactivatePricingContract()`
- Contract lookup in `calculator.ts`: `lookupRates(clientId, companyId, date)` — returns contract rates or defaults

**Test:**
1. Create contract for client valid today → create shipment for that client → uses contract rates (check pricing_snapshot)
2. Contract expired yesterday → shipment uses default rates

---

### T3.3 · Mapbox Distance Calculation
**What:** Integrate Mapbox Directions API to calculate real route distance.
**Depends:** T0.1

**Deliverables:**
- `src/lib/mapbox/directions.ts`: `getRouteDistance(from: {lat, lng}, to: {lat, lng})` → `{ distanceKm: number, durationMin: number }`
- Called server-side only (token not exposed in client for this call)
- `src/lib/mapbox/geocoding.ts`: `forwardGeocode(addressString)` → `{ lat, lng, formattedAddress }`
- Both functions handle API errors gracefully (return null + log, don't throw)
- `src/components/maps/geocoder-input.tsx`: address input field with Mapbox autocomplete, emits `{lat, lng, street, city, ...}` on selection

**Test:**
1. Type "Casablanca, Maroc" → geocoder returns coordinates
2. Casablanca → Rabat directions → ~90 km result
3. Mapbox API unreachable → form shows error, still allows manual price override

---

## Phase 4 — Shipments (Dispatcher)

### T4.1 · Create Shipment Form
**What:** Dispatcher creates a shipment with geocoding + auto-price calculation.
**Depends:** T3.3, T3.2, T2.1, T2.2, T2.3

**Deliverables:**
- `shipments/new/page.tsx`: multi-section form
  - Client selector (searchable)
  - Pickup address (geocoder input → auto-fills lat/lng + address fields)
  - Delivery address (same)
  - Cargo: weight_kg, volume_m3, description, fragile, goods_value
  - Schedule: pickup_scheduled_at, delivery_scheduled_at
  - Urgency checkbox (auto-detects if < 24h from now, or manual override)
  - Price calculation: runs on address + urgency change → shows breakdown (base + km + urgency + TVA)
  - Manual price override field (shows when dispatcher wants to set custom price)
- `src/actions/shipments.ts`: `createShipment()`
  - Calls `getRouteDistance()` for distance_km
  - Calls `lookupRates()` + `calculatePrice()` for pricing
  - Generates reference via `next_sequence_value(companyId, 'shipment')`
  - Saves `pricing_snapshot`
  - Inserts status history entry: `created`
- No driver assignment at creation (separate action)

**Test:**
1. Fill form → price preview updates as address changes
2. Submit → shipment created with status `created`, reference generated
3. Check `pricing_snapshot` in DB → contains rates used

---

### T4.2 · Shipment List + Filters
**What:** Paginated shipment list with status/date/client/driver filters.
**Depends:** T4.1

**Deliverables:**
- `shipments/page.tsx`: TanStack Table with server-side pagination
- Filter bar: status (multi-select), date range (created_at), client, driver, search (reference)
- Status badge component with color coding
- Quick stats row: today's shipments count by status
- `src/hooks/use-shipments.ts`: `useShipments(filters)` with React Query

**Test:**
1. Filter by `status=delivered` → only delivered shipments
2. Filter by client → only that client's shipments
3. RLS check: dispatcher sees all company shipments; client only their own

---

### T4.3 · Driver Assignment
**What:** Dispatcher assigns a driver (and vehicle) to a shipment.
**Depends:** T4.1, T2.2

**Deliverables:**
- `shipments/[id]/page.tsx`: "Assign Driver" section → dropdown of available drivers with their current vehicle
- `src/actions/shipments.ts`: `assignDriver(shipmentId, driverId, vehicleId)`
  - Updates `assigned_driver_id`, `assigned_vehicle_id`, `status = 'assigned'`
  - Inserts status history entry
  - Triggers notification to driver (if `notify_on_assignment = true`)
- Unassign: resets to `status = 'created'`, clears driver + vehicle
- Driver availability: marks `is_available = false` on assignment (optional, configurable)

**Test:**
1. Assign driver → shipment status → `assigned`; driver receives email notification
2. Dispatcher can unassign and reassign to a different driver
3. Driver logs in → sees this shipment in their list

---

### T4.4 · Shipment Detail Page (Dispatcher)
**What:** Full shipment information with timeline and documents.
**Depends:** T4.3

**Deliverables:**
- `shipments/[id]/page.tsx`: complete detail view
  - Header: reference, status badge, client name, dates
  - Two-column: left = addresses + cargo + pricing; right = map
  - Status timeline (shipment_status_history entries)
  - Assigned driver + vehicle card
  - Documents section: POD photos + signature (if delivered)
  - Action buttons: Edit (if not delivered), Cancel, Assign/Unassign Driver

**Test:**
1. Navigate to delivered shipment → POD photo and signature visible
2. Cancel a `created` shipment → status → `cancelled`; cannot cancel `delivered` shipments

---

### T4.5 · Route Map Display
**What:** Show pickup-to-delivery route on a Mapbox map.
**Depends:** T4.4, T3.3

**Deliverables:**
- `src/components/maps/route-map.tsx`: Mapbox GL map showing:
  - Green pin: pickup location
  - Red pin: delivery location
  - Blue polyline: Directions API route (fetched server-side, passed as prop)
- Map rendered only when both lat/lng pairs are available
- Fallback: if no coordinates → "Route non disponible" placeholder

**Test:**
1. Shipment with both addresses geocoded → map shows route
2. Shipment with missing coordinates → placeholder shown, no JS error

---

## Phase 5 — Driver Mobile Flow

### T5.1 · Driver Dashboard (Mobile)
**What:** Mobile-first view showing the driver's assigned shipments.
**Depends:** T4.3

**Deliverables:**
- `(driver)/my-shipments/page.tsx`: card list of assigned shipments, sorted by pickup_scheduled_at
- Each card: client name, pickup city → delivery city, scheduled time, status badge
- Tab bar: My Shipments | Profile
- "In progress" shipment (picked_up or in_transit) pinned at top
- Realtime subscription: new assignment → shipment appears without refresh

**Test:**
1. Dispatcher assigns shipment → driver sees it appear in real time (without page refresh)
2. Mobile viewport: cards are full-width, touch targets ≥ 44px

---

### T5.2 · Status Update Flow (Driver)
**What:** Driver updates shipment status through the delivery lifecycle.
**Depends:** T5.1

**Deliverables:**
- `(driver)/delivery/[id]/page.tsx`: shipment detail + large action buttons
- Status transition buttons (contextual — only valid next statuses shown):
  - `assigned` → button "Confirmer ramassage" → `picked_up`
  - `picked_up` → button "Partir en livraison" → `in_transit`
  - `in_transit` → button "Livré" → redirects to POD capture (T5.3) → `delivered`
  - Any status → "Signaler un problème" → `failed` with required notes field
- Each transition: inserts `shipment_status_history` row with `changed_by = driver`
- Optimistic update: button shows "Mise à jour..." immediately

**Test:**
1. Driver confirms pickup → status `picked_up` → dispatcher dashboard updates in real time
2. Driver tries to mark `created` shipment as `delivered` → action rejected (RLS + app-level check)

---

### T5.3 · Proof of Delivery — Photo Upload
**What:** Driver uploads a photo as proof of delivery.
**Depends:** T5.2

**Deliverables:**
- `(driver)/delivery/[id]/pod/page.tsx`: photo capture screen
- Camera input (`<input type="file" accept="image/*" capture="environment">`) for mobile
- Image preview + re-take button
- On submit: upload to Supabase Storage `pod-documents/{companyId}/{shipmentId}/photo-{timestamp}.jpg`
- `src/actions/documents.ts`: `uploadPODPhoto()` — validates MIME + size (max 10 MB), inserts `shipment_documents` row

**Test:**
1. Upload 8 MB JPEG → success → file visible in Storage + shipment_documents row
2. Upload PDF (wrong MIME) → rejected with error message
3. Client can view the uploaded photo via signed URL (RLS allows `pod_photo` for their shipments)

---

### T5.4 · Proof of Delivery — E-Signature
**What:** Driver captures client's signature on phone screen.
**Depends:** T5.3

**Deliverables:**
- Install: `npm install react-signature-canvas`
- `src/components/forms/pod-capture-form.tsx`: signature canvas (full-width, 300px height)
- Clear button + Save button
- On save: exports canvas as PNG blob → uploads to Storage `pod-documents/{companyId}/{shipmentId}/signature-{timestamp}.png`
- Both photo and signature required before status can advance to `delivered`
- After both uploaded: `completeDelivery()` server action sets status → `delivered`

**Test:**
1. Draw signature → save → PNG uploaded to Storage → `pod_signature` row in shipment_documents
2. Skip signature → "Livré" action blocked with error: "Preuve de livraison incomplète"
3. Dispatcher sees signature on shipment detail page (served via signed URL)

---

## Phase 6 — Real-time Updates

### T6.1 · Realtime Subscription Hook
**What:** Supabase Realtime subscription for live shipment status updates.
**Depends:** T0.6

**Deliverables:**
- `src/hooks/use-realtime-shipments.ts`: subscribes to `shipments` table changes filtered by `company_id`
- On INSERT or UPDATE: invalidates `shipmentKeys.list()` and `shipmentKeys.detail(id)` in React Query cache
- Unsubscribes in cleanup function
- Used in:
  - Dispatcher's `shipments/page.tsx`
  - Driver's `my-shipments/page.tsx` (filtered to `assigned_driver_id`)

**Test:**
1. Dispatcher page open + driver updates status → dispatcher's status badge changes without reload
2. Open browser DevTools → Network → no polling requests visible; only WS connection

---

### T6.2 · Live Dashboard KPIs
**What:** Dashboard KPI cards update in real time as shipments change.
**Depends:** T6.1

**Deliverables:**
- `dashboard/page.tsx`: 4 KPI cards using `v_shipment_kpis` view
  - Today's shipments | Active shipments | Monthly revenue | On-time rate
- On Realtime event → invalidate KPI query → cards re-fetch and update
- KPI card component with loading skeleton

---

## Phase 7 — Invoicing

### T7.1 · Per-Shipment Invoice Generation
**What:** Auto-generate invoice when a shipment is delivered (billing_mode = per_shipment).
**Depends:** T5.4, T3.1

**Deliverables:**
- Called from `completeDelivery()` server action (T5.4) after status → `delivered`
- `src/actions/invoices.ts`: `generateInvoiceForShipment(shipmentId)`
  - Check client.billing_mode === 'per_shipment'
  - Generate invoice_number via `next_sequence_value(companyId, 'invoice')`
  - Calculate due_at = CURRENT_DATE + client.payment_terms_days
  - Insert invoice + invoice_shipments join row
  - Set shipment.invoice_id
  - Queue invoice notification

**Test:**
1. Mark shipment delivered (per_shipment client) → invoice auto-created → visible in invoices list
2. Client logs in → sees the invoice in their portal

---

### T7.2 · Monthly Grouped Invoice Generation
**What:** Generate one invoice per client covering all uninvoiced delivered shipments of the month.
**Depends:** T7.1

**Deliverables:**
- `invoices/generate/page.tsx`: manual trigger UI (company_admin only)
  - Shows: N clients with M uninvoiced shipments since [period_start]
  - "Generate All" button → calls `generateMonthlyInvoices()`
- `src/actions/invoices.ts`: `generateMonthlyInvoices(companyId, periodStart, periodEnd)`
  - Groups delivered, uninvoiced shipments by client (billing_mode = monthly_grouped)
  - Creates one invoice per client with all shipments linked
- (Future: automate via Edge Function cron `0 8 1 * *`)

**Test:**
1. 3 delivered shipments for a monthly client → generate → 1 invoice with 3 lines
2. Clients with billing_mode = per_shipment → NOT included in this generation run

---

### T7.3 · PDF Invoice Generation
**What:** Generate a branded PDF invoice downloadable by dispatcher and client.
**Depends:** T7.1

**Deliverables:**
- `src/lib/pdf/invoice-document.tsx`: react-pdf `<Document>` with:
  - Company logo, name, address, ICE, bank details (from companies table)
  - Client details
  - Line items: one row per shipment (reference, description, pickup→delivery cities, price HT)
  - Subtotal HT, TVA, Total TTC
  - Payment terms + bank wire details
  - Footer text from company_settings
- `src/app/api/invoices/[id]/pdf/route.ts`: GET handler → `renderToBuffer()` → returns PDF stream
- "Download PDF" button on invoice detail page → calls this route handler
- On invoice creation: upload PDF to Storage `invoice-pdfs/{companyId}/{invoiceId}.pdf`, save `pdf_url`

**Test:**
1. Click "Télécharger PDF" on invoice → PDF downloads with correct amounts and company branding
2. Client portal: same PDF button works (signed URL, expires in 15 min)

---

### T7.4 · Invoice List + Payment Tracking
**What:** Invoice management with status filter and payment recording.
**Depends:** T7.1

**Deliverables:**
- `invoices/page.tsx`: table with invoice_number, client, total, amount_paid, status badge, due_at, days overdue
- Overdue banner at top: "X factures en retard — Total: Y MAD"
- `invoices/[id]/page.tsx`: invoice detail with shipment lines + payment history
- `src/components/forms/payment-form.tsx`: record payment (amount, date, method, reference)
- `src/actions/invoices.ts`: `recordPayment()` — inserts invoice_payments; trigger syncs invoice status
- Filter: status (unpaid / partially_paid / paid / overdue)

**Test:**
1. Record partial payment → invoice status → `partially_paid`; record remainder → `paid`
2. Overdue invoice: `mark_overdue_invoices()` function changes status → `overdue` when due_at < today

---

### T7.5 · Overdue Invoice Detection
**What:** Automatically mark past-due invoices as overdue.
**Depends:** T7.4

**Deliverables:**
- Supabase Edge Function: `supabase/functions/daily-invoice-check/index.ts`
  - Calls `SELECT public.mark_overdue_invoices()`
  - Logs count of updated invoices
- Cron schedule: `0 2 * * *` (2am daily, Africa/Casablanca)
- `src/components/shared/overdue-alert-banner.tsx`: shows on invoices page and dashboard

**Test:**
1. Invoice with due_at = yesterday → run Edge Function → status changes to `overdue`
2. Banner appears on dashboard: "3 factures en retard"

---

## Phase 8 — Notifications

### T8.1 · Email Notifications (Resend)
**What:** Send transactional emails for key shipment and invoice events.
**Depends:** T4.3, T7.1

**Deliverables:**
- `src/lib/notifications/email-provider.ts`: Resend client
- `src/lib/notifications/templates/`: 4 email templates (plain HTML):
  - `shipment-assigned.ts`: driver assigned, with shipment details
  - `shipment-delivered.ts`: client notification with POD link
  - `invoice-issued.ts`: client receives invoice with PDF link + payment instructions
  - `invoice-overdue.ts`: client reminder with balance due + bank details
- `src/lib/notifications/index.ts`: `NotificationService.send()` routes to email or WhatsApp provider
- All sends: insert `notifications` row first, then attempt delivery, update status

**Test:**
1. Assign driver → driver receives email with pickup address
2. Mark shipment delivered → client receives email with signed PDF link
3. Resend API error → notification row shows `status: 'failed'`, `error_message` populated

---

### T8.2 · WhatsApp Notification Stub
**What:** WhatsApp provider stub ready for activation when WHATSAPP_ENABLED=true.
**Depends:** T8.1

**Deliverables:**
- `src/lib/notifications/whatsapp-provider.ts`:
  - When `NEXT_PUBLIC_WHATSAPP_ENABLED=false`: logs payload + returns `{ success: true }` (silent skip)
  - When `true`: sends via WhatsApp Business API (placeholder implementation, documented with TODO)
- `NotificationService` selects provider by channel. If client has `whatsapp_phone` → queue WhatsApp; else email
- `notifications` table `channel` field tracks which was used

**Test:**
1. WhatsApp disabled → notification sent via email, log shows "WhatsApp skipped"
2. Enable flag → notification attempts WhatsApp (stubbed → success log)

---

## Phase 9 — Dashboard & KPIs

### T9.1 · Dispatcher Dashboard
**What:** Main dashboard with KPI cards, charts, and live shipment summary.
**Depends:** T6.2, T7.5

**Deliverables:**
- `dashboard/page.tsx`: desktop-first grid layout
  - Row 1: 4 KPI cards (today's shipments, active, monthly revenue, on-time rate %)
  - Row 2: Shipments by status (donut chart using recharts or chart.js)
  - Row 3: Revenue over last 12 months (bar chart)
  - Row 4: Active shipments table (in_transit + picked_up), live-updating
  - Row 5: Overdue invoices summary
- Install: `npm install recharts`
- Charts fetch via React Query from `v_shipment_kpis` view

**Test:**
1. Dashboard loads in < 2s on first visit
2. Create new shipment → "Active shipments" count increments in real time

---

### T9.2 · Driver Performance Report
**What:** Per-driver stats table for management review.
**Depends:** T2.2

**Deliverables:**
- `reports/page.tsx`: driver performance table
  - Columns: name, total_deliveries, on_time_rate, average_rating, total_km_driven
  - Date range filter (filters by shipment delivery date)
  - Export to CSV button

**Test:**
1. Driver completes 3 deliveries → stats update on this page
2. Export CSV → downloadable file with correct data

---

## Phase 10 — Client Portal

### T10.1 · Client Shipment List
**What:** Client-facing read-only shipment tracking.
**Depends:** T4.2

**Deliverables:**
- `(client)/shipments/page.tsx`: client's shipments with status badges + dates
- `(client)/shipments/[id]/page.tsx`: shipment detail with:
  - Route map (pickup → delivery)
  - Status timeline
  - POD photo + signature (if delivered)
- Real-time status updates via Supabase Realtime (filtered to client's shipments)

**Test:**
1. Client logs in → sees only their own shipments (not other clients')
2. Status updates in real time when driver updates from mobile

---

### T10.2 · Client Invoice Portal
**What:** Client can view and download their invoices.
**Depends:** T7.3, T10.1

**Deliverables:**
- `(client)/invoices/page.tsx`: invoice list with status, total, due date
- `(client)/invoices/[id]/page.tsx`: invoice detail with shipment lines + PDF download
- Signed PDF URL generated server-side (15-minute TTL)

**Test:**
1. Client sees only their invoices (RLS check)
2. PDF download link expires after 15 min → re-request generates fresh link

---

## Phase 11 — Settings & Admin

### T11.1 · Company Settings
**What:** Admin configures company identity information.
**Depends:** T0.5

**Deliverables:**
- `settings/page.tsx`: form for company name, address, logo, tax_id, vat_number, bank details
- Logo upload to `avatars` bucket → updates `companies.logo_url`
- These fields appear on generated PDF invoices

**Test:**
1. Update company logo → new invoices PDF shows updated logo
2. Dispatcher cannot access settings (company_admin only)

---

### T11.2 · Notification Settings
**What:** Admin configures which events trigger notifications.
**Depends:** T8.1

**Deliverables:**
- `settings/notifications/page.tsx`: toggle switches for each `notify_*` flag in company_settings
- Preview of notification templates (rendered with example data)
- Overdue reminder day configuration

**Test:**
1. Disable `notify_on_assignment` → assign driver → no email sent (check notifications table: status `skipped`)

---

## Summary: Execution Order

```
Phase 0:  T0.1 → T0.2 → T0.3 → T0.4 → T0.5 → T0.6          (1 week)
Phase 1:  T1.1 → T1.2                                         (3 days)
Phase 2:  T2.1, T2.2 (parallel) → T2.3                        (4 days)
Phase 3:  T3.1 → T3.2, T3.3 (parallel)                        (4 days)
Phase 4:  T4.1 → T4.2, T4.3 (parallel) → T4.4 → T4.5         (1 week)
Phase 5:  T5.1 → T5.2 → T5.3 → T5.4                          (1 week)
Phase 6:  T6.1 → T6.2                                         (2 days)
Phase 7:  T7.1 → T7.2, T7.3 (parallel) → T7.4 → T7.5         (1 week)
Phase 8:  T8.1 → T8.2                                         (3 days)
Phase 9:  T9.1 → T9.2                                         (3 days)
Phase 10: T10.1 → T10.2                                       (3 days)
Phase 11: T11.1, T11.2 (parallel)                             (2 days)
──────────────────────────────────────────────────────────────
Total estimated: ~7 weeks for a focused solo developer
```

---

## Deferred (Post-MVP)

- **T12.x International shipments** — customs UX when `INTERNATIONAL_ENABLED=true`
- **T13.x WhatsApp Business integration** — replace stub with real API
- **T14.x AI email parsing** — auto-create shipments from client email requests
- **T15.x Accounting export** — Sage/CEGID-compatible CSV export
- **T16.x Multi-stop shipments** — more than one delivery per trip
- **T17.x Driver mobile offline mode** — IndexedDB + background sync
