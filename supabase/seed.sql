-- ============================================================
-- TMS LOGISTIQUE — SEED DATA
-- Run AFTER the initial schema migration.
-- Creates a demo company + pricing defaults for local development.
-- ============================================================

-- Demo company
INSERT INTO public.companies (id, name, slug, tax_id, phone, email, address, city, country)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Logistique SARL',
  'demo',
  '001234567000001',
  '+212522000001',
  'admin@demo-tms.ma',
  '123 Boulevard Mohammed V',
  'Casablanca',
  'MA'
) ON CONFLICT (id) DO NOTHING;

-- Pricing defaults for demo company
INSERT INTO public.pricing_defaults (company_id, base_fee, price_per_km, urgency_surcharge_pct, vat_rate)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  100.00,
  5.00,
  50.00,
  20.00
) ON CONFLICT (company_id) DO NOTHING;

-- Note: Auth users must be created via Supabase Dashboard (Authentication → Users → Add user)
-- with Auto Confirm enabled, then linked to public.users via INSERT statements with the
-- matching auth.users.id and role.

-- ============================================================
-- JIT (flux tendu) policy seed for the two strict automotive customers
--
-- These UPDATEs are idempotent and safe to re-run. They are no-ops on
-- a fresh install (no client rows yet) and only fire once the user has
-- created TESCA / SAGE through the dashboard. The migration
-- 20260430210000_jit_strict.sql ships the same logic, but the seed
-- is the canonical place for "always-on demo data".
-- ============================================================
UPDATE public.clients
SET delivery_window_strict    = true,
    late_penalty_per_hour_mad = 5000,
    late_tolerance_minutes    = 0
WHERE business_name ILIKE 'TESCA%'
  AND deleted_at IS NULL;

UPDATE public.clients
SET delivery_window_strict    = true,
    late_penalty_per_hour_mad = 3000,
    late_tolerance_minutes    = 0
WHERE business_name ILIKE 'SAGE%'
  AND deleted_at IS NULL;
