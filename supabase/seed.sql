-- ============================================================
-- TMS LOGISTIQUE — SEED DATA
-- Run AFTER the initial schema migration.
-- Creates a demo company + super_admin user for local development.
-- ============================================================

-- Demo company
INSERT INTO public.companies (id, name, ice, phone, email, address, city, country, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Logistique SARL',
  '001234567000001',
  '+212522000001',
  'admin@demo-tms.ma',
  '123 Boulevard Mohammed V',
  'Casablanca',
  'MA',
  'pro'
) ON CONFLICT (id) DO NOTHING;

-- Pricing defaults for demo company
INSERT INTO public.pricing_defaults (company_id, base_fee, price_per_km, urgency_surcharge_pct, vat_rate_pct, payment_terms_days)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  100.00,
  5.00,
  50.00,
  20.00,
  30
) ON CONFLICT (company_id) DO NOTHING;

-- Note: The super_admin user must be created via Supabase Auth (Dashboard or CLI):
--   supabase auth add-user --email admin@demo-tms.ma --password Demo1234!
-- Then update the users table with:
--   UPDATE public.users SET role = 'super_admin', company_id = '00000000-0000-0000-0000-000000000001', full_name = 'Admin Demo', is_active = true WHERE email = 'admin@demo-tms.ma';
