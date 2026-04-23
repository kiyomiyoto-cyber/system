-- ============================================================
-- TMS LOGISTIQUE — SUPABASE DATABASE SCHEMA
-- Version: 1.0.0
-- Paste this entire file into the Supabase SQL Editor and execute.
-- Compatible with PostgreSQL 15+ (Supabase standard).
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- enables trigram indexes for ILIKE search

-- ============================================================
-- SHARED TRIGGER: auto-set updated_at on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- RLS HELPER FUNCTIONS
-- All are SECURITY DEFINER so they bypass RLS on public.users
-- when called from within a policy, preventing infinite recursion.
-- SET search_path = public prevents search_path injection attacks.
-- ============================================================

-- Returns the company_id of the currently authenticated user.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id
  FROM public.users
  WHERE id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1
$$;

-- Returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1
$$;

-- Returns true if the current user has any of the given roles.
CREATE OR REPLACE FUNCTION public.has_any_role(VARIADIC roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = ANY(roles)
      AND deleted_at IS NULL
  )
$$;

-- Returns the drivers.id for the currently authenticated driver user.
-- Returns NULL if the user is not a driver.
CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id
  FROM public.drivers d
  WHERE d.user_id = auth.uid()
    AND d.deleted_at IS NULL
  LIMIT 1
$$;

-- Returns the clients.id for the currently authenticated client portal user.
-- Returns NULL if the user is not a client.
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  LIMIT 1
$$;

-- ============================================================
-- SEQUENCE COUNTER TABLE
-- Provides race-condition-safe sequential references per company per year.
-- Used for shipment references (EXP-YY-NNNNN) and invoice numbers (FAC-YY-NNNNN).
-- ============================================================
CREATE TABLE public.sequence_counters (
  company_id  uuid      NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type        text      NOT NULL,  -- 'shipment' | 'invoice'
  year        smallint  NOT NULL,
  last_value  integer   NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, type, year)
);

-- Atomically increments and returns the next value for a given sequence.
-- Uses INSERT ... ON CONFLICT ... DO UPDATE which is fully atomic in Postgres.
CREATE OR REPLACE FUNCTION public.next_sequence_value(
  p_company_id  uuid,
  p_type        text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year  smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
  v_next  integer;
BEGIN
  INSERT INTO public.sequence_counters (company_id, type, year, last_value)
  VALUES (p_company_id, p_type, v_year, 1)
  ON CONFLICT (company_id, type, year)
  DO UPDATE SET last_value = sequence_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

-- ============================================================
-- TABLE: companies
-- Root of the multi-tenant hierarchy. Each row is an independent
-- logistics company. All other tables reference this via company_id.
-- ============================================================
CREATE TABLE public.companies (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  slug              text        NOT NULL UNIQUE,   -- URL-safe, used in references (e.g. "translog-ma")
  logo_url          text,
  address           text,
  city              text,
  country           char(2)     NOT NULL DEFAULT 'MA',
  phone             text,
  email             text,
  tax_id            text,                          -- ICE: Identifiant Commun de l'Entreprise (Morocco)
  vat_number        text,                          -- Numéro TVA intracommunautaire
  bank_iban         text,
  bank_swift        text,
  default_currency  char(3)     NOT NULL DEFAULT 'MAD',
  timezone          text        NOT NULL DEFAULT 'Africa/Casablanca',
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- super_admin manages all companies
CREATE POLICY "companies_super_admin_all" ON public.companies
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- all users can read their own company record
CREATE POLICY "companies_self_select" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_company_id());

-- ============================================================
-- TABLE: users
-- All application users. Extends auth.users with role + company.
-- Created automatically via trigger on auth.users insert.
-- ============================================================
CREATE TABLE public.users (
  id                  uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id          uuid    REFERENCES public.companies(id) ON DELETE RESTRICT,  -- NULL for super_admin
  role                text    NOT NULL CHECK (role IN (
                                'super_admin', 'company_admin', 'dispatcher', 'driver', 'client'
                              )),
  full_name           text    NOT NULL,
  email               text    NOT NULL,
  phone               text,
  avatar_url          text,
  preferred_language  char(2) NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'ar')),
  is_active           boolean NOT NULL DEFAULT true,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_users_company_id ON public.users(company_id);
CREATE INDEX idx_users_role       ON public.users(role);
CREATE INDEX idx_users_email      ON public.users(email);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_super_admin_all" ON public.users
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- company_admin and dispatcher can view all users in their company
CREATE POLICY "users_staff_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- company_admin can create, update, deactivate users in their company
CREATE POLICY "users_admin_write" ON public.users
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  );

-- any user can view their own profile
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- any user can update their own non-sensitive fields
-- role and company_id changes are blocked by the WITH CHECK
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role      = (SELECT role       FROM public.users WHERE id = auth.uid())
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- ============================================================
-- TABLE: clients
-- B2B clients. Each client belongs to one logistics company.
-- ============================================================
CREATE TABLE public.clients (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id             uuid        REFERENCES public.users(id) ON DELETE SET NULL,  -- set when client has portal access
  business_name       text        NOT NULL,
  contact_name        text        NOT NULL,
  contact_email       text        NOT NULL,
  contact_phone       text        NOT NULL,
  whatsapp_phone      text,
  address             text,
  city                text,
  country             char(2)     NOT NULL DEFAULT 'MA',
  tax_id              text,                          -- ICE du client B2B
  billing_mode        text        NOT NULL DEFAULT 'per_shipment'
                                  CHECK (billing_mode IN ('per_shipment', 'monthly_grouped')),
  payment_terms_days  integer     NOT NULL DEFAULT 30
                                  CHECK (payment_terms_days IN (0, 15, 30, 60, 90)),
  notes               text,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_clients_user_id    ON public.clients(user_id);
CREATE INDEX idx_clients_name       ON public.clients USING gin(business_name gin_trgm_ops);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_super_admin" ON public.clients
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "clients_staff_all" ON public.clients
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- client portal user can view their own client record only
CREATE POLICY "clients_self_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() = 'client'
  );

-- ============================================================
-- TABLE: drivers
-- Drivers are salaried employees. Performance stats tracked for management.
-- No commission calculation in MVP.
-- ============================================================
CREATE TABLE public.drivers (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id                 uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  full_name               text          NOT NULL,
  phone                   text          NOT NULL,
  whatsapp_phone          text,
  license_number          text          NOT NULL,
  license_expiry          date          NOT NULL,
  cin_number              text          NOT NULL,  -- Carte d'Identité Nationale (Morocco)
  cin_expiry              date,
  monthly_salary          numeric(10,2),           -- reference only, no auto-calculation
  is_available            boolean       NOT NULL DEFAULT true,
  -- Performance stats (updated by trigger on shipment status change)
  total_deliveries        integer       NOT NULL DEFAULT 0,
  on_time_delivery_count  integer       NOT NULL DEFAULT 0,
  on_time_delivery_rate   numeric(5,2)  NOT NULL DEFAULT 0,   -- percentage 0-100
  average_rating          numeric(3,2)  NOT NULL DEFAULT 0,   -- 1.00-5.00
  total_km_driven         numeric(10,2) NOT NULL DEFAULT 0,
  avatar_url              text,
  notes                   text,
  is_active               boolean       NOT NULL DEFAULT true,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE INDEX idx_drivers_company_id ON public.drivers(company_id);
CREATE INDEX idx_drivers_user_id    ON public.drivers(user_id);
CREATE INDEX idx_drivers_available  ON public.drivers(company_id, is_available)
  WHERE is_available = true AND deleted_at IS NULL;

CREATE TRIGGER trg_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_super_admin" ON public.drivers
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "drivers_staff_all" ON public.drivers
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- driver can view their own profile
CREATE POLICY "drivers_self_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.current_user_role() = 'driver');

-- driver can update availability on their own record
CREATE POLICY "drivers_self_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING    (user_id = auth.uid() AND public.current_user_role() = 'driver')
  WITH CHECK (user_id = auth.uid() AND public.current_user_role() = 'driver');

-- ============================================================
-- TABLE: vehicles
-- Fleet management. Includes document expiry tracking.
-- ============================================================
CREATE TABLE public.vehicles (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  plate_number          text          NOT NULL,
  brand                 text          NOT NULL,
  model                 text          NOT NULL,
  year                  smallint,
  type                  text          NOT NULL
                                      CHECK (type IN ('motorcycle', 'van', 'truck', 'pickup')),
  max_weight_kg         numeric(8,2),
  volume_m3             numeric(6,2),
  color                 text,
  vin                   text,
  insurance_number      text,
  insurance_expiry      date,
  registration_expiry   date,
  last_maintenance_date date,
  next_maintenance_date date,
  mileage_km            numeric(10,2) NOT NULL DEFAULT 0,
  is_available          boolean       NOT NULL DEFAULT true,
  notes                 text,
  is_active             boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE UNIQUE INDEX idx_vehicles_plate ON public.vehicles(company_id, plate_number)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_company_id ON public.vehicles(company_id);

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_super_admin" ON public.vehicles
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "vehicles_staff_all" ON public.vehicles
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- drivers can see vehicles in their company (to know their assigned vehicle)
CREATE POLICY "vehicles_driver_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
  );

-- ============================================================
-- TABLE: driver_vehicle_assignments
-- History of driver ↔ vehicle assignments.
-- Current assignment: WHERE unassigned_at IS NULL.
-- ============================================================
CREATE TABLE public.driver_vehicle_assignments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  driver_id     uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  vehicle_id    uuid        NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,              -- NULL = currently active
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dva_company_id  ON public.driver_vehicle_assignments(company_id);
CREATE INDEX idx_dva_driver_id   ON public.driver_vehicle_assignments(driver_id);
CREATE INDEX idx_dva_vehicle_id  ON public.driver_vehicle_assignments(vehicle_id);
-- Partial index for fast "current assignment" lookups
CREATE UNIQUE INDEX idx_dva_current_driver ON public.driver_vehicle_assignments(driver_id)
  WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX idx_dva_current_vehicle ON public.driver_vehicle_assignments(vehicle_id)
  WHERE unassigned_at IS NULL;

ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dva_super_admin" ON public.driver_vehicle_assignments
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "dva_staff_all" ON public.driver_vehicle_assignments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

CREATE POLICY "dva_driver_select" ON public.driver_vehicle_assignments
  FOR SELECT TO authenticated
  USING (
    driver_id = public.current_driver_id()
    AND public.current_user_role() = 'driver'
  );

-- ============================================================
-- TABLE: pricing_defaults
-- Company-level default pricing. Exactly one row per company.
-- Auto-created by trigger when a company is inserted.
-- ============================================================
CREATE TABLE public.pricing_defaults (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  base_fee                numeric(10,2) NOT NULL DEFAULT 100.00,      -- MAD
  price_per_km            numeric(10,4) NOT NULL DEFAULT 5.0000,      -- MAD/km
  urgency_surcharge_pct   numeric(5,2)  NOT NULL DEFAULT 50.00,       -- % added to price_excl_tax
  urgency_threshold_hours integer       NOT NULL DEFAULT 24,          -- "urgent" if delivery within N hours
  vat_rate                numeric(5,2)  NOT NULL DEFAULT 20.00,       -- Morocco TVA standard rate
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_pricing_defaults_updated_at
  BEFORE UPDATE ON public.pricing_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pricing_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pd_super_admin" ON public.pricing_defaults
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- company_admin can read and update default pricing
CREATE POLICY "pd_admin_all" ON public.pricing_defaults
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  );

-- dispatcher can read (to show calculated prices)
CREATE POLICY "pd_dispatcher_select" ON public.pricing_defaults
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'dispatcher'
  );

-- ============================================================
-- TABLE: client_pricing_contracts
-- Custom negotiated rates per client.
-- If an active contract exists, it overrides pricing_defaults.
-- ============================================================
CREATE TABLE public.client_pricing_contracts (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id             uuid          NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  base_fee              numeric(10,2) NOT NULL,
  price_per_km          numeric(10,4) NOT NULL,
  urgency_surcharge_pct numeric(5,2)  NOT NULL DEFAULT 50.00,
  valid_from            date          NOT NULL,
  valid_to              date,                      -- NULL = open-ended contract
  notes                 text,
  is_active             boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpc_company_id ON public.client_pricing_contracts(company_id);
CREATE INDEX idx_cpc_client_id  ON public.client_pricing_contracts(client_id);
-- Partial index for active contract lookups
CREATE INDEX idx_cpc_active ON public.client_pricing_contracts(client_id, valid_from)
  WHERE is_active = true;

CREATE TRIGGER trg_cpc_updated_at
  BEFORE UPDATE ON public.client_pricing_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_pricing_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpc_super_admin" ON public.client_pricing_contracts
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cpc_staff_all" ON public.client_pricing_contracts
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- TABLE: shipments
-- Core entity. Every delivery from pickup to invoicing lives here.
-- Addresses are embedded (denormalized) for immutable historical accuracy.
-- ============================================================
CREATE TABLE public.shipments (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reference             text          NOT NULL,   -- e.g. TRANSLOG-EXP-24-00042
  client_id             uuid          NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  assigned_driver_id    uuid          REFERENCES public.drivers(id) ON DELETE SET NULL,
  assigned_vehicle_id   uuid          REFERENCES public.vehicles(id) ON DELETE SET NULL,

  -- Lifecycle
  status                text          NOT NULL DEFAULT 'created'
                                      CHECK (status IN (
                                        'created',           -- dispatcher created it
                                        'assigned',          -- driver assigned
                                        'picked_up',         -- driver confirmed pickup
                                        'in_transit',        -- en route
                                        'customs_clearance', -- at customs (international only)
                                        'delivered',         -- delivered successfully
                                        'failed',            -- delivery attempt failed
                                        'cancelled'          -- cancelled before pickup
                                      )),

  -- Pickup (embedded for historical immutability)
  pickup_street         text          NOT NULL,
  pickup_city           text          NOT NULL,
  pickup_postal_code    text,
  pickup_region         text,
  pickup_country        char(2)       NOT NULL DEFAULT 'MA',
  pickup_lat            numeric(10,7),
  pickup_lng            numeric(10,7),
  pickup_contact_name   text,
  pickup_contact_phone  text,
  pickup_notes          text,
  pickup_scheduled_at   timestamptz,
  pickup_actual_at      timestamptz,

  -- Delivery
  delivery_street       text          NOT NULL,
  delivery_city         text          NOT NULL,
  delivery_postal_code  text,
  delivery_region       text,
  delivery_country      char(2)       NOT NULL DEFAULT 'MA',
  delivery_lat          numeric(10,7),
  delivery_lng          numeric(10,7),
  delivery_contact_name text,
  delivery_contact_phone text,
  delivery_notes        text,
  delivery_scheduled_at timestamptz,
  delivery_actual_at    timestamptz,

  -- Cargo
  weight_kg             numeric(8,2),
  volume_m3             numeric(6,2),
  description           text,
  goods_value           numeric(12,2),            -- declared value for insurance/customs
  fragile               boolean       NOT NULL DEFAULT false,

  -- Pricing (immutable after creation — rates snapshot preserved separately)
  distance_km           numeric(8,2),             -- calculated by Mapbox Directions API
  is_urgent             boolean       NOT NULL DEFAULT false,
  price_excl_tax        numeric(12,2),
  tax_amount            numeric(12,2),
  price_incl_tax        numeric(12,2),
  pricing_snapshot      jsonb,                    -- {base_fee, price_per_km, urgency_pct, vat_rate, contract_id}
  manual_price_override numeric(12,2),            -- dispatcher override of calculated price_excl_tax

  -- International fields (schema always present; UI gated by INTERNATIONAL_ENABLED flag)
  is_international      boolean       NOT NULL DEFAULT false,
  customs_declaration_value numeric(12,2),
  customs_hs_code       text,
  customs_notes         text,

  -- Invoice linkage (FK added below after invoices table)
  invoice_id            uuid,

  created_by            uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE UNIQUE INDEX idx_shipments_reference  ON public.shipments(company_id, reference);
CREATE INDEX idx_shipments_company_id        ON public.shipments(company_id);
CREATE INDEX idx_shipments_client_id         ON public.shipments(client_id);
CREATE INDEX idx_shipments_driver_id         ON public.shipments(assigned_driver_id);
CREATE INDEX idx_shipments_status            ON public.shipments(company_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_created_at        ON public.shipments(company_id, created_at DESC);
CREATE INDEX idx_shipments_invoice_id        ON public.shipments(invoice_id);
CREATE INDEX idx_shipments_uninvoiced        ON public.shipments(company_id, client_id)
  WHERE status = 'delivered' AND invoice_id IS NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_super_admin" ON public.shipments
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- dispatcher and admin: full CRUD within their company
CREATE POLICY "shipments_staff_all" ON public.shipments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- driver: SELECT only their assigned shipments
CREATE POLICY "shipments_driver_select" ON public.shipments
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND assigned_driver_id = public.current_driver_id()
  );

-- driver: UPDATE status on their assigned shipments only
-- application code must further restrict which fields can be changed
CREATE POLICY "shipments_driver_update" ON public.shipments
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND assigned_driver_id = public.current_driver_id()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND assigned_driver_id = public.current_driver_id()
  );

-- client: SELECT their own shipments (read-only portal)
CREATE POLICY "shipments_client_select" ON public.shipments
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

-- ============================================================
-- TABLE: shipment_status_history
-- Immutable audit log. Every status transition is recorded here.
-- Never UPDATE or DELETE rows in this table.
-- ============================================================
CREATE TABLE public.shipment_status_history (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  shipment_id  uuid          NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status       text          NOT NULL,
  notes        text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  changed_by   uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_ssh_company_id  ON public.shipment_status_history(company_id);
CREATE INDEX idx_ssh_shipment_id ON public.shipment_status_history(shipment_id);

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssh_super_admin" ON public.shipment_status_history
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "ssh_staff_all" ON public.shipment_status_history
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'driver')
  );

-- driver: insert history for their assigned shipments
CREATE POLICY "ssh_driver_insert" ON public.shipment_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE assigned_driver_id = public.current_driver_id()
        AND company_id = public.current_company_id()
    )
  );

CREATE POLICY "ssh_driver_select" ON public.shipment_status_history
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'driver'
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE assigned_driver_id = public.current_driver_id()
    )
  );

-- client: can see status history of their shipments
CREATE POLICY "ssh_client_select" ON public.shipment_status_history
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE client_id = public.current_client_id()
    )
  );

-- ============================================================
-- TABLE: shipment_documents
-- POD photos, e-signatures, customs docs — all stored in Supabase Storage.
-- file_url references a private Storage bucket; serve via signed URLs only.
-- ============================================================
CREATE TABLE public.shipment_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  shipment_id     uuid        NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  type            text        NOT NULL
                              CHECK (type IN ('pod_photo', 'pod_signature', 'customs_doc', 'other')),
  file_url        text        NOT NULL,   -- Storage path: "{bucket}/{company_id}/{shipment_id}/{filename}"
  file_name       text,
  file_size_bytes integer,
  mime_type       text,
  uploaded_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sd_company_id  ON public.shipment_documents(company_id);
CREATE INDEX idx_sd_shipment_id ON public.shipment_documents(shipment_id);

ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sd_super_admin" ON public.shipment_documents
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "sd_staff_all" ON public.shipment_documents
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- driver: can insert and read documents for their assigned shipments
CREATE POLICY "sd_driver_insert" ON public.shipment_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE assigned_driver_id = public.current_driver_id()
        AND company_id = public.current_company_id()
    )
  );

CREATE POLICY "sd_driver_select" ON public.shipment_documents
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'driver'
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE assigned_driver_id = public.current_driver_id()
    )
  );

-- client: can view POD documents (photo + signature) for their shipments
CREATE POLICY "sd_client_select" ON public.shipment_documents
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND type IN ('pod_photo', 'pod_signature')
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE client_id = public.current_client_id()
    )
  );

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE public.invoices (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id         uuid          NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number    text          NOT NULL,   -- e.g. TRANSLOG-FAC-24-00015
  issued_at         date          NOT NULL DEFAULT CURRENT_DATE,
  due_at            date          NOT NULL,   -- issued_at + client.payment_terms_days
  period_start      date,                     -- for monthly_grouped invoices
  period_end        date,                     -- for monthly_grouped invoices
  subtotal_excl_tax numeric(12,2) NOT NULL,
  tax_rate          numeric(5,2)  NOT NULL,
  tax_amount        numeric(12,2) NOT NULL,
  total_incl_tax    numeric(12,2) NOT NULL,
  amount_paid       numeric(12,2) NOT NULL DEFAULT 0,
  status            text          NOT NULL DEFAULT 'unpaid'
                                  CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  pdf_url           text,                     -- Storage path for generated PDF
  notes             text,
  created_by        uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invoices_number    ON public.invoices(company_id, invoice_number);
CREATE INDEX idx_invoices_company_id       ON public.invoices(company_id);
CREATE INDEX idx_invoices_client_id        ON public.invoices(client_id);
CREATE INDEX idx_invoices_status           ON public.invoices(company_id, status);
-- Partial index for overdue detection (only open invoices need checking)
CREATE INDEX idx_invoices_due_open         ON public.invoices(company_id, due_at)
  WHERE status IN ('unpaid', 'partially_paid');

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_super_admin" ON public.invoices
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "invoices_staff_all" ON public.invoices
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- client: SELECT only their own invoices
CREATE POLICY "invoices_client_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

-- ============================================================
-- TABLE: invoice_shipments
-- M2M join: one invoice can cover multiple shipments (monthly_grouped).
-- ============================================================
CREATE TABLE public.invoice_shipments (
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
  PRIMARY KEY (invoice_id, shipment_id)
);

CREATE INDEX idx_iship_shipment_id ON public.invoice_shipments(shipment_id);

ALTER TABLE public.invoice_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iship_super_admin" ON public.invoice_shipments
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "iship_staff_all" ON public.invoice_shipments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id = public.current_company_id()
        AND public.has_any_role('company_admin', 'dispatcher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id = public.current_company_id()
        AND public.has_any_role('company_admin', 'dispatcher')
    )
  );

CREATE POLICY "iship_client_select" ON public.invoice_shipments
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id = public.current_client_id()
    )
  );

-- ============================================================
-- FK: shipments.invoice_id → invoices.id (deferred — invoices table needed first)
-- ============================================================
ALTER TABLE public.shipments
  ADD CONSTRAINT fk_shipments_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: invoice_payments
-- Records of bank transfer payments received against an invoice.
-- ============================================================
CREATE TABLE public.invoice_payments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id      uuid          NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date    date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method  text          NOT NULL DEFAULT 'bank_transfer'
                                CHECK (payment_method IN ('bank_transfer', 'check', 'cash')),
  reference       text,          -- bank wire reference number
  notes           text,
  recorded_by     uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_ipay_company_id  ON public.invoice_payments(company_id);
CREATE INDEX idx_ipay_invoice_id  ON public.invoice_payments(invoice_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ipay_super_admin" ON public.invoice_payments
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "ipay_staff_all" ON public.invoice_payments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- TABLE: driver_ratings
-- Client rates the driver after a delivery. One rating per shipment.
-- ============================================================
CREATE TABLE public.driver_ratings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  shipment_id uuid        NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id)
);

CREATE INDEX idx_dr_company_id ON public.driver_ratings(company_id);
CREATE INDEX idx_dr_driver_id  ON public.driver_ratings(driver_id);
CREATE INDEX idx_dr_client_id  ON public.driver_ratings(client_id);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dr_super_admin" ON public.driver_ratings
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "dr_staff_select" ON public.driver_ratings
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- client can submit one rating per delivered shipment
CREATE POLICY "dr_client_insert" ON public.driver_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
    AND shipment_id IN (
      SELECT id FROM public.shipments
      WHERE client_id = public.current_client_id()
        AND status = 'delivered'
    )
  );

CREATE POLICY "dr_client_select" ON public.driver_ratings
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

CREATE POLICY "dr_driver_select" ON public.driver_ratings
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'driver'
    AND driver_id = public.current_driver_id()
  );

-- ============================================================
-- TABLE: notifications
-- Outbound notification queue. Email + WhatsApp (stub).
-- A background job polls status='pending' and attempts delivery.
-- ============================================================
CREATE TABLE public.notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  type              text        NOT NULL,   -- 'shipment_assigned' | 'invoice_issued' | 'invoice_overdue' | ...
  channel           text        NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  recipient_email   text,
  recipient_phone   text,
  subject           text,
  body              text        NOT NULL,
  metadata          jsonb,                  -- arbitrary data for rendering templates
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts          smallint    NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  sent_at           timestamptz,
  error_message     text,
  shipment_id       uuid        REFERENCES public.shipments(id) ON DELETE SET NULL,
  invoice_id        uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_company_id ON public.notifications(company_id);
CREATE INDEX idx_notif_pending    ON public.notifications(created_at)
  WHERE status = 'pending';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_super_admin" ON public.notifications
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "notif_staff_all" ON public.notifications
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- TABLE: vehicle_maintenance_records
-- Tracks all maintenance events. Alerts generated from vehicle expiry dates.
-- ============================================================
CREATE TABLE public.vehicle_maintenance_records (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  vehicle_id          uuid          NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  type                text          NOT NULL,   -- 'oil_change' | 'tire' | 'insurance' | 'registration' | 'general'
  description         text,
  cost                numeric(10,2),
  performed_at        date          NOT NULL,
  next_due_at         date,
  mileage_at_service  numeric(10,2),
  notes               text,
  created_by          uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_vmr_company_id ON public.vehicle_maintenance_records(company_id);
CREATE INDEX idx_vmr_vehicle_id ON public.vehicle_maintenance_records(vehicle_id);

ALTER TABLE public.vehicle_maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vmr_super_admin" ON public.vehicle_maintenance_records
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "vmr_staff_all" ON public.vehicle_maintenance_records
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- TABLE: company_settings
-- Per-company feature flags and configuration. One row per company.
-- Auto-created by trigger when a company is inserted.
-- ============================================================
CREATE TABLE public.company_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid        NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Feature flags
  international_enabled   boolean     NOT NULL DEFAULT false,
  whatsapp_enabled        boolean     NOT NULL DEFAULT false,
  client_portal_enabled   boolean     NOT NULL DEFAULT true,
  driver_ratings_enabled  boolean     NOT NULL DEFAULT true,
  -- Notification triggers
  notify_on_assignment    boolean     NOT NULL DEFAULT true,
  notify_on_pickup        boolean     NOT NULL DEFAULT true,
  notify_on_delivery      boolean     NOT NULL DEFAULT true,
  notify_on_invoice       boolean     NOT NULL DEFAULT true,
  notify_overdue_day_7    boolean     NOT NULL DEFAULT true,
  notify_overdue_day_15   boolean     NOT NULL DEFAULT true,
  notify_overdue_day_30   boolean     NOT NULL DEFAULT true,
  -- Invoice presentation
  invoice_footer_text     text,
  -- Email
  email_from_name         text,
  email_reply_to          text,
  -- WhatsApp (only relevant when whatsapp_enabled = true)
  whatsapp_sender_id      text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_super_admin" ON public.company_settings
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cs_admin_all" ON public.company_settings
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'company_admin'
  );

-- other roles can read settings (needed to check feature flags)
CREATE POLICY "cs_staff_select" ON public.company_settings
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- ============================================================
-- TRIGGER: auto-initialize company defaults on new company creation
-- Creates pricing_defaults and company_settings rows automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.init_company_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.pricing_defaults (company_id) VALUES (NEW.id);
  INSERT INTO public.company_settings (company_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.init_company_defaults();

-- ============================================================
-- TRIGGER: update driver performance stats on delivery
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_driver_stats_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_on_time  integer;
BEGIN
  -- only fires when transitioning INTO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_on_time := CASE
    WHEN NEW.delivery_actual_at IS NOT NULL
      AND NEW.delivery_scheduled_at IS NOT NULL
      AND NEW.delivery_actual_at <= NEW.delivery_scheduled_at
    THEN 1
    ELSE 0
  END;

  UPDATE public.drivers
  SET
    total_deliveries       = total_deliveries + 1,
    on_time_delivery_count = on_time_delivery_count + v_on_time,
    on_time_delivery_rate  = ROUND(
      (on_time_delivery_count + v_on_time)::numeric
      / NULLIF(total_deliveries + 1, 0) * 100, 2
    ),
    total_km_driven = total_km_driven + COALESCE(NEW.distance_km, 0)
  WHERE id = NEW.assigned_driver_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shipment_delivered
  AFTER UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_driver_stats_on_delivery();

-- ============================================================
-- TRIGGER: update invoice status + amount_paid after payment recorded
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paid  numeric(12,2);
  v_total numeric(12,2);
BEGIN
  SELECT
    COALESCE(SUM(p.amount), 0),
    i.total_incl_tax
  INTO v_paid, v_total
  FROM public.invoice_payments p
  JOIN public.invoices i ON i.id = p.invoice_id
  WHERE p.invoice_id = NEW.invoice_id
  GROUP BY i.total_incl_tax;

  UPDATE public.invoices
  SET
    amount_paid = v_paid,
    status = CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0        THEN 'partially_paid'
      ELSE                        'unpaid'
    END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_inserted
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_status();

-- ============================================================
-- TRIGGER: recalculate driver average_rating after new rating
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_driver_avg_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.drivers
  SET average_rating = (
    SELECT ROUND(AVG(rating)::numeric, 2)
    FROM public.driver_ratings
    WHERE driver_id = NEW.driver_id
  )
  WHERE id = NEW.driver_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rating_inserted
  AFTER INSERT ON public.driver_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_driver_avg_rating();

-- ============================================================
-- FUNCTION: mark_overdue_invoices
-- Called by a Supabase Edge Function cron job (daily at 02:00).
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status IN ('unpaid', 'partially_paid')
    AND due_at < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- VIEWS
-- Note: views are SECURITY INVOKER by default — the caller's RLS applies.
-- These views are safe to expose to authenticated users.
-- ============================================================

-- Current vehicle assigned to each driver
CREATE OR REPLACE VIEW public.v_driver_current_vehicle AS
SELECT
  d.id            AS driver_id,
  d.company_id,
  d.full_name     AS driver_name,
  d.phone,
  d.is_available,
  d.total_deliveries,
  d.on_time_delivery_rate,
  d.average_rating,
  v.id            AS vehicle_id,
  v.plate_number,
  v.brand,
  v.model,
  v.type          AS vehicle_type,
  dva.assigned_at
FROM public.drivers d
LEFT JOIN public.driver_vehicle_assignments dva
  ON dva.driver_id = d.id AND dva.unassigned_at IS NULL
LEFT JOIN public.vehicles v
  ON v.id = dva.vehicle_id
WHERE d.deleted_at IS NULL
  AND d.is_active = true;

-- Dashboard KPIs per company (uses CURRENT_DATE so always fresh)
CREATE OR REPLACE VIEW public.v_shipment_kpis AS
SELECT
  company_id,
  COUNT(*)                                                                       AS total_all_time,
  COUNT(*) FILTER (WHERE DATE(created_at AT TIME ZONE 'Africa/Casablanca') = CURRENT_DATE)
                                                                                 AS shipments_today,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('week',  CURRENT_TIMESTAMP))  AS shipments_this_week,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))  AS shipments_this_month,
  COUNT(*) FILTER (WHERE status IN ('created','assigned','picked_up','in_transit'))
                                                                                 AS active_shipments,
  COUNT(*) FILTER (WHERE status = 'delivered' AND created_at >= date_trunc('month', CURRENT_TIMESTAMP))
                                                                                 AS delivered_this_month,
  ROUND(
    COUNT(*) FILTER (
      WHERE status = 'delivered'
        AND delivery_actual_at  IS NOT NULL
        AND delivery_scheduled_at IS NOT NULL
        AND delivery_actual_at <= delivery_scheduled_at
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
    )::numeric
    / NULLIF(
        COUNT(*) FILTER (
          WHERE status = 'delivered'
            AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        ), 0
    ) * 100, 1
  )                                                                              AS on_time_rate_pct,
  COALESCE(SUM(price_incl_tax) FILTER (
    WHERE status = 'delivered'
      AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
  ), 0)                                                                          AS revenue_this_month
FROM public.shipments
WHERE deleted_at IS NULL
GROUP BY company_id;

-- Overdue invoices with client contact info (for automated reminders)
CREATE OR REPLACE VIEW public.v_overdue_invoices AS
SELECT
  i.id,
  i.company_id,
  i.invoice_number,
  i.client_id,
  c.business_name      AS client_name,
  c.contact_email,
  c.whatsapp_phone,
  i.total_incl_tax,
  i.amount_paid,
  i.total_incl_tax - i.amount_paid AS balance_due,
  i.due_at,
  CURRENT_DATE - i.due_at          AS days_overdue
FROM public.invoices i
JOIN public.clients c ON c.id = i.client_id
WHERE i.status IN ('unpaid', 'partially_paid', 'overdue')
  AND i.due_at < CURRENT_DATE
  AND c.deleted_at IS NULL;

-- ============================================================
-- STORAGE BUCKETS
-- Create these in the Supabase dashboard → Storage → New Bucket.
-- All buckets: Private (not public).
-- ============================================================
-- bucket: pod-documents       → POD photos + e-signatures
-- bucket: invoice-pdfs        → Generated invoice PDFs
-- bucket: customs-docs        → Customs declaration uploads
-- bucket: avatars             → User and driver profile photos
--
-- Storage RLS (add in dashboard → Storage → Policies):
-- Allow authenticated users to INSERT into pod-documents
--   WHERE (storage.foldername(name))[1] = auth.uid()::text
-- Allow company members to SELECT files in their company folder
--   WHERE (storage.foldername(name))[1] = current_company_id()::text

-- ============================================================
-- INITIAL SEED EXAMPLE
-- Run after creating your first company via the admin UI or directly:
-- ============================================================
-- INSERT INTO public.companies (name, slug, email, city, country)
-- VALUES ('Ma Société Logistique', 'masociete', 'contact@masociete.ma', 'Casablanca', 'MA')
-- RETURNING id;
--
-- -- Then create the super_admin user in Supabase Auth dashboard,
-- -- and insert their profile:
-- INSERT INTO public.users (id, role, full_name, email)
-- VALUES ('<auth-user-id>', 'super_admin', 'Admin Principal', 'admin@masociete.ma');

COMMIT;
