-- ============================================================
-- M4: Macarons + Péages
--
-- Tracks two distinct families:
--   1. vehicle_passes — Jawaz / Pass+ electronic toll cards (per
--      vehicle, identified by tag number, with running balance).
--   2. toll_transactions — every toll crossing recorded against a
--      pass; FK back to accounting_documents per the cross-ticket
--      integration note (the receipt may be captured separately
--      via COMPTA-1).
--   3. vignettes — annual macaron / vignette stickers per vehicle
--      with an expiry date (used for fleet compliance dashboard).
-- ============================================================

BEGIN;

-- ============================================================
-- vehicle_passes
-- ============================================================
CREATE TABLE public.vehicle_passes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id          uuid NOT NULL REFERENCES public.vehicles(id)  ON DELETE RESTRICT,

  provider            text NOT NULL CHECK (provider IN ('jawaz','passplus','autre')),
  tag_number          text NOT NULL,
  device_serial       text,

  current_balance_mad numeric(12,2) NOT NULL DEFAULT 0,
  low_balance_threshold_mad numeric(12,2) NOT NULL DEFAULT 100,

  is_active           boolean NOT NULL DEFAULT true,
  notes               text,

  created_by_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT vehicle_passes_unique_tag UNIQUE (company_id, provider, tag_number)
);

CREATE INDEX vehicle_passes_company_idx
  ON public.vehicle_passes (company_id, is_active)
  WHERE deleted_at IS NULL;
CREATE INDEX vehicle_passes_vehicle_idx
  ON public.vehicle_passes (vehicle_id);

CREATE TRIGGER vehicle_passes_set_updated_at
  BEFORE UPDATE ON public.vehicle_passes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vehicle_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_passes_super_admin" ON public.vehicle_passes
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "vehicle_passes_back_office" ON public.vehicle_passes
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
-- toll_transactions
-- ============================================================
CREATE TABLE public.toll_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_pass_id         uuid NOT NULL REFERENCES public.vehicle_passes(id) ON DELETE RESTRICT,
  vehicle_id              uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,

  -- Optional FK so a captured receipt (COMPTA-1) can be matched to the
  -- toll crossing without duplicating the financial document.
  accounting_document_id  uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,

  -- Optional shipment back-link if the dispatcher associates the toll
  -- with a specific mission for cost analysis.
  shipment_id             uuid REFERENCES public.shipments(id) ON DELETE SET NULL,

  kind                    text NOT NULL DEFAULT 'crossing'
                          CHECK (kind IN ('crossing','top_up','adjustment')),
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  station                 text,
  amount_mad              numeric(12,2) NOT NULL,                 -- negative for crossing, positive for top_up
  reference               text,
  notes                   text,

  created_by_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX toll_transactions_pass_idx
  ON public.toll_transactions (vehicle_pass_id, occurred_at DESC);
CREATE INDEX toll_transactions_company_idx
  ON public.toll_transactions (company_id, occurred_at DESC);
CREATE INDEX toll_transactions_shipment_idx
  ON public.toll_transactions (shipment_id) WHERE shipment_id IS NOT NULL;

ALTER TABLE public.toll_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "toll_transactions_super_admin" ON public.toll_transactions
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "toll_transactions_back_office" ON public.toll_transactions
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
-- Recompute pass balance when transactions change.
-- amount_mad is signed (negative for crossing, positive for top_up).
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_vehicle_pass_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pass_id uuid;
  v_balance numeric(12,2);
BEGIN
  v_pass_id := COALESCE(NEW.vehicle_pass_id, OLD.vehicle_pass_id);
  IF v_pass_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(amount_mad), 0) INTO v_balance
  FROM public.toll_transactions WHERE vehicle_pass_id = v_pass_id;

  UPDATE public.vehicle_passes
  SET current_balance_mad = v_balance
  WHERE id = v_pass_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_toll_transactions_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.toll_transactions
  FOR EACH ROW EXECUTE FUNCTION public.recompute_vehicle_pass_balance();

-- ============================================================
-- vignettes — annual macarons / stickers per vehicle
-- ============================================================
CREATE TABLE public.vignettes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id          uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,

  kind                text NOT NULL CHECK (kind IN ('annual','technical_inspection','insurance','tax_disc','other')),
  reference           text,
  amount_mad          numeric(12,2),
  issued_at           date NOT NULL,
  expires_at          date NOT NULL,

  -- Optional link to a captured receipt
  accounting_document_id uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,

  notes               text,
  created_by_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX vignettes_company_idx
  ON public.vignettes (company_id, expires_at)
  WHERE deleted_at IS NULL;
CREATE INDEX vignettes_vehicle_idx
  ON public.vignettes (vehicle_id, expires_at);

CREATE TRIGGER vignettes_set_updated_at
  BEFORE UPDATE ON public.vignettes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vignettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vignettes_super_admin" ON public.vignettes
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "vignettes_back_office" ON public.vignettes
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
-- View: fleet macaron status (which vehicle has expiring vignettes)
-- ============================================================
CREATE OR REPLACE VIEW public.v_fleet_compliance AS
  SELECT
    v.company_id,
    v.id                    AS vehicle_id,
    v.plate_number,
    v.is_active,
    -- Latest vignette of each kind per vehicle
    MAX(CASE WHEN vg.kind = 'annual' THEN vg.expires_at END)               AS annual_expires_at,
    MAX(CASE WHEN vg.kind = 'technical_inspection' THEN vg.expires_at END) AS visite_expires_at,
    MAX(CASE WHEN vg.kind = 'insurance' THEN vg.expires_at END)            AS insurance_expires_at,
    MAX(CASE WHEN vg.kind = 'tax_disc' THEN vg.expires_at END)             AS tax_disc_expires_at,
    -- Worst expiring soon (any vignette < 30 days from now)
    MIN(vg.expires_at) FILTER (
      WHERE vg.expires_at >= CURRENT_DATE
        AND vg.expires_at <= CURRENT_DATE + INTERVAL '30 days'
        AND vg.deleted_at IS NULL
    ) AS earliest_expiring_within_30d,
    -- Pass low-balance flag (any active pass below threshold)
    BOOL_OR(p.current_balance_mad < p.low_balance_threshold_mad
            AND p.is_active AND p.deleted_at IS NULL)                       AS pass_low_balance
  FROM public.vehicles v
  LEFT JOIN public.vignettes vg
    ON vg.vehicle_id = v.id AND vg.deleted_at IS NULL
  LEFT JOIN public.vehicle_passes p
    ON p.vehicle_id = v.id AND p.deleted_at IS NULL
  WHERE v.deleted_at IS NULL
  GROUP BY v.company_id, v.id, v.plate_number, v.is_active;

GRANT SELECT ON public.v_fleet_compliance TO authenticated;

-- ============================================================
-- Audit log entity_type extension
-- ============================================================
ALTER TABLE public.accounting_audit_log
  DROP CONSTRAINT IF EXISTS accounting_audit_log_entity_type_check;

ALTER TABLE public.accounting_audit_log
  ADD CONSTRAINT accounting_audit_log_entity_type_check
  CHECK (entity_type IN (
    'accounting_document',
    'monthly_dossier',
    'tax_declaration',
    'payroll_data',
    'accountant_profile',
    'subcontracted_mission',
    'subcontractor',
    'client_jit_policy',
    'shipment_customs_document',
    'free_zone',
    'customs_document_type',
    'recurring_schedule',
    'cmr_document',
    'whatsapp_template',
    'whatsapp_send',
    'supplier',
    'supplier_invoice',
    'supplier_payment',
    'vehicle_pass',
    'toll_transaction',
    'vignette'
  ));

COMMIT;
