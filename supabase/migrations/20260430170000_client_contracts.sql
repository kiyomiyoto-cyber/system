-- ============================================================
-- N-5: client_contracts + contract_pricing_grid
-- Replaces the simple per-km rate model with a per-route, per-vehicle
-- pricing grid suited to automotive B2B contracts (TESCA, SAGE, ERT,
-- COBA, DUTCHER each negotiate fixed lane prices).
--
-- The legacy public.client_pricing_contracts is kept untouched: the
-- pricing engine will be migrated in a separate ticket.
-- ============================================================

BEGIN;

-- ============================================================
-- client_contracts
-- One row per signed/verbal commercial contract with a client.
-- ============================================================
CREATE TABLE public.client_contracts (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id               uuid          NOT NULL REFERENCES public.clients(id)   ON DELETE RESTRICT,

  contract_number         text,                                    -- internal ref, optional
  signed_date             date,
  start_date              date          NOT NULL,
  end_date                date,                                    -- NULL = open-ended

  payment_terms_days      integer       NOT NULL DEFAULT 30
                                        CHECK (payment_terms_days IN (0, 15, 30, 45, 60, 90)),
  billing_mode            text          NOT NULL DEFAULT 'per_shipment'
                                        CHECK (billing_mode IN ('per_shipment', 'monthly_grouped')),
  auto_renewal            boolean       NOT NULL DEFAULT false,

  status                  text          NOT NULL DEFAULT 'active' CHECK (status IN (
                                          'active',
                                          'expired',
                                          'cancelled',
                                          'draft'
                                        )),

  contract_pdf_path       text,                                    -- path inside accounting-documents bucket
  notes                   text,

  created_by_user_id      uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

-- One active contract per client at a time. New contracts must
-- expire/cancel the previous one (enforced in application code).
CREATE INDEX idx_client_contracts_company_id ON public.client_contracts(company_id);
CREATE INDEX idx_client_contracts_client_id  ON public.client_contracts(client_id);
CREATE INDEX idx_client_contracts_active
  ON public.client_contracts(client_id, start_date)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE TRIGGER trg_client_contracts_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_super_admin" ON public.client_contracts
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cc_back_office_all" ON public.client_contracts
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

-- Client portal user reads their own contract (read-only)
CREATE POLICY "cc_client_self_select" ON public.client_contracts
  FOR SELECT TO authenticated
  USING (
    client_id = public.current_client_id()
    AND public.current_user_role() = 'client'
  );

-- ============================================================
-- contract_pricing_grid
-- One row per (contract, route, vehicle_type). Empty vehicle_type
-- means "all vehicles". Empty route_label is allowed for default
-- catch-all rules.
-- ============================================================
CREATE TABLE public.contract_pricing_grid (
  id                              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                     uuid          NOT NULL REFERENCES public.client_contracts(id) ON DELETE CASCADE,
  company_id                      uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  route_label                     text          NOT NULL,                    -- e.g. "Tanger ↔ Kénitra"
  pickup_city                     text,
  delivery_city                   text,
  vehicle_type                    text          CHECK (vehicle_type IS NULL OR vehicle_type IN (
                                                  'motorcycle', 'van', 'truck', 'pickup'
                                                )),

  base_price_mad                  numeric(12,2) NOT NULL CHECK (base_price_mad >= 0),

  -- Surcharges (percent of base_price_mad unless waiting which is MAD/h)
  surcharge_night_pct             numeric(5,2)  NOT NULL DEFAULT 30.00 CHECK (surcharge_night_pct >= 0),
  surcharge_weekend_pct           numeric(5,2)  NOT NULL DEFAULT 50.00 CHECK (surcharge_weekend_pct >= 0),
  surcharge_urgent_pct            numeric(5,2)  NOT NULL DEFAULT 25.00 CHECK (surcharge_urgent_pct >= 0),
  surcharge_waiting_per_hour_mad  numeric(10,2) NOT NULL DEFAULT 0     CHECK (surcharge_waiting_per_hour_mad >= 0),

  customs_zone                    boolean       NOT NULL DEFAULT false,
  notes                           text,

  is_active                       boolean       NOT NULL DEFAULT true,
  sort_order                      integer       NOT NULL DEFAULT 0,

  created_at                      timestamptz   NOT NULL DEFAULT now(),
  updated_at                      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpg_contract       ON public.contract_pricing_grid(contract_id, sort_order);
CREATE INDEX idx_cpg_company        ON public.contract_pricing_grid(company_id);
CREATE INDEX idx_cpg_lookup
  ON public.contract_pricing_grid(contract_id, pickup_city, delivery_city, vehicle_type)
  WHERE is_active = true;

CREATE TRIGGER trg_cpg_updated_at
  BEFORE UPDATE ON public.contract_pricing_grid
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contract_pricing_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpg_super_admin" ON public.contract_pricing_grid
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cpg_back_office_all" ON public.contract_pricing_grid
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

-- ============================================================
-- SEED: pre-fill draft contracts for TESCA + SAGE if those clients
-- exist and have no contract yet.
-- ERT, COBA, DUTCHER are intentionally skipped per user instruction
-- — their terms remain verbal until the user formalizes them.
-- ============================================================
DO $$
DECLARE
  v_client_id uuid;
  v_company_id uuid;
  v_contract_id uuid;
  v_seed_record RECORD;
  v_route_record RECORD;
BEGIN
  FOR v_seed_record IN
    SELECT * FROM (VALUES
      ('TESCA', 30, 'monthly_grouped'),
      ('SAGE',  30, 'monthly_grouped')
    ) AS seed(client_name, terms, billing)
  LOOP
    SELECT c.id, c.company_id INTO v_client_id, v_company_id
    FROM public.clients c
    WHERE c.business_name ILIKE '%' || v_seed_record.client_name || '%'
      AND c.deleted_at IS NULL
    LIMIT 1;

    IF v_client_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip if a contract already exists
    IF EXISTS (
      SELECT 1 FROM public.client_contracts
      WHERE client_id = v_client_id AND deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.client_contracts (
      company_id, client_id, contract_number,
      start_date, payment_terms_days, billing_mode, status, notes
    )
    VALUES (
      v_company_id, v_client_id, v_seed_record.client_name || '-AUTO-2026',
      CURRENT_DATE, v_seed_record.terms, v_seed_record.billing, 'draft',
      'Brouillon initial — à compléter avec les prix négociés et signer.'
    )
    RETURNING id INTO v_contract_id;

    -- Seed standard automotive routes (placeholder prices — admin must
    -- adjust per actual negotiation).
    FOR v_route_record IN
      SELECT * FROM (VALUES
        ('Tanger ↔ Kénitra',   'Tanger',  'Kénitra', 1500.00, 0),
        ('Kénitra ↔ Tiflet',   'Kénitra', 'Tiflet',  1200.00, 1),
        ('Tanger ↔ Tiflet',    'Tanger',  'Tiflet',  2200.00, 2)
      ) AS routes(label, pickup, delivery, price, sort_idx)
    LOOP
      INSERT INTO public.contract_pricing_grid (
        contract_id, company_id, route_label, pickup_city, delivery_city,
        base_price_mad, sort_order
      )
      VALUES (
        v_contract_id, v_company_id, v_route_record.label,
        v_route_record.pickup, v_route_record.delivery,
        v_route_record.price, v_route_record.sort_idx
      );
    END LOOP;
  END LOOP;
END $$;

COMMIT;
