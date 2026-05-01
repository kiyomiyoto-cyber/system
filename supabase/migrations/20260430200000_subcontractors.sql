-- ============================================================
-- N-3: Sous-traitance — partners + missions + margin tracking
--
-- MASLAK occasionally subcontracts missions to a small set (3–5)
-- of recurring partners when the in-house fleet is full. The user
-- needs to:
--   1. Maintain a directory of subcontractors (rich enough since
--      the set is small and high-touch).
--   2. Subcontract a shipment with a negotiated cost and track
--      margin (client price - subcontractor cost).
--   3. Generate a mission order ("ordre de mission") PDF stored
--      privately and send it via email / WhatsApp.
--
-- This migration ships:
--   - subcontractors table (RLS, super_admin + back-office policies)
--   - subcontracted_missions table (1:1 with shipment, margin via
--     generated columns)
--   - shipments.subcontracted_mission_id back-link (SET NULL on delete)
--   - private Storage bucket `mission-orders`
--   - Storage RLS policies (super_admin + back-office)
-- ============================================================

BEGIN;

-- ============================================================
-- subcontractors
-- ============================================================
CREATE TABLE public.subcontractors (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  name                   text          NOT NULL,
  legal_form             text,                                       -- SARL, SA, auto-entrepreneur, etc.

  -- Moroccan business identifiers
  ice                    text,                                       -- Identifiant Commun de l'Entreprise (15 digits)
  rc_number              text,                                       -- Registre de commerce
  tax_id                 text,                                       -- Identifiant Fiscal (IF)
  cnss_number            text,                                       -- Caisse Nationale de Sécurité Sociale

  -- Primary contact
  contact_name           text,
  contact_phone          text,
  contact_email          text,
  whatsapp_phone         text,                                       -- often distinct from voice line

  -- Address
  address                text,
  city                   text,
  postal_code            text,

  -- Operational profile
  vehicle_types          text[]        NOT NULL DEFAULT ARRAY[]::text[]
                                       CHECK (vehicle_types <@ ARRAY['motorcycle','van','truck','pickup']::text[]),
  service_areas          text[]        NOT NULL DEFAULT ARRAY[]::text[],   -- free-form cities/regions
  capacity_kg            integer       CHECK (capacity_kg IS NULL OR capacity_kg > 0),

  -- Quality (1 = poor, 5 = excellent). NULL until first rated.
  rating                 smallint      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_count           integer       NOT NULL DEFAULT 0 CHECK (rating_count >= 0),

  -- Banking (for paying invoices)
  bank_name              text,
  bank_iban              text,
  bank_swift             text,

  payment_terms_days     smallint      NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 180),

  notes                  text,
  is_active              boolean       NOT NULL DEFAULT true,

  created_by_user_id     uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  deleted_at             timestamptz,

  CONSTRAINT subcontractors_name_unique
    UNIQUE (company_id, name)
);

CREATE INDEX idx_subcontractors_company       ON public.subcontractors(company_id);
CREATE INDEX idx_subcontractors_active        ON public.subcontractors(company_id, is_active)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_subcontractors_name_search   ON public.subcontractors(company_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_subcontractors_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractors_super_admin" ON public.subcontractors
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "subcontractors_back_office_select" ON public.subcontractors
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "subcontractors_back_office_write" ON public.subcontractors
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
-- subcontracted_missions
--
-- Exactly one row per shipment that is subcontracted (1:1).
-- Holds the negotiated cost, the snapshot of the sale price at
-- creation time (so margin is frozen even if shipment.price_excl_tax
-- is later edited), and the lifecycle of the mission order
-- document (draft → sent → accepted → in_progress → completed).
-- ============================================================
CREATE TABLE public.subcontracted_missions (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid          NOT NULL REFERENCES public.companies(id)     ON DELETE RESTRICT,
  subcontractor_id         uuid          NOT NULL REFERENCES public.subcontractors(id) ON DELETE RESTRICT,
  shipment_id              uuid          NOT NULL REFERENCES public.shipments(id)      ON DELETE RESTRICT,

  mission_order_number     text          NOT NULL,                  -- {COMPANY_SLUG}-OM-{YY}-{NNNNN}

  -- Pricing (frozen at creation)
  cost_excl_tax            numeric(12,2) NOT NULL CHECK (cost_excl_tax >= 0),
  sale_excl_tax            numeric(12,2) NOT NULL CHECK (sale_excl_tax >= 0),
  -- Generated columns: kept in sync by Postgres, can be indexed/queried directly.
  margin_excl_tax          numeric(12,2) GENERATED ALWAYS AS (sale_excl_tax - cost_excl_tax) STORED,
  margin_pct               numeric(6,2)  GENERATED ALWAYS AS (
                              CASE
                                WHEN sale_excl_tax > 0
                                  THEN ((sale_excl_tax - cost_excl_tax) / sale_excl_tax) * 100
                                ELSE 0
                              END
                            ) STORED,
  currency                 char(3)       NOT NULL DEFAULT 'MAD',

  -- Status
  status                   text          NOT NULL DEFAULT 'draft'
                                         CHECK (status IN (
                                           'draft',         -- created, not yet sent
                                           'sent',          -- mission order transmitted
                                           'accepted',      -- subcontractor confirmed
                                           'in_progress',   -- en route
                                           'completed',     -- delivered, ready to invoice
                                           'cancelled'
                                         )),

  -- Mission order document
  mission_order_pdf_path   text,                                    -- Storage path inside `mission-orders` bucket
  sent_at                  timestamptz,
  sent_via                 text          CHECK (sent_via IS NULL OR sent_via IN ('email', 'whatsapp', 'manual')),
  sent_to                  text,                                    -- recipient (email/phone) at time of send
  accepted_at              timestamptz,
  completed_at             timestamptz,

  -- Free-form
  notes                    text,
  internal_notes           text,                                    -- not on the PDF

  created_by_user_id       uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz,

  -- 1:1 with shipment (only one active subcontracting record per shipment)
  CONSTRAINT subcontracted_missions_shipment_unique
    UNIQUE (shipment_id),

  -- Mission order numbers are unique per company
  CONSTRAINT subcontracted_missions_number_unique
    UNIQUE (company_id, mission_order_number)
);

CREATE INDEX idx_subm_company_created    ON public.subcontracted_missions(company_id, created_at DESC);
CREATE INDEX idx_subm_subcontractor      ON public.subcontracted_missions(subcontractor_id);
CREATE INDEX idx_subm_status             ON public.subcontracted_missions(company_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_subm_shipment           ON public.subcontracted_missions(shipment_id);

CREATE TRIGGER trg_subm_updated_at
  BEFORE UPDATE ON public.subcontracted_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defense in depth: enforce same-company between subcontractor and shipment.
-- RLS already prevents cross-company reads, but a malicious INSERT could mix
-- two tenants. Trigger guards against it.
CREATE OR REPLACE FUNCTION public.enforce_subm_company()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sub_co  uuid;
  v_ship_co uuid;
BEGIN
  SELECT company_id INTO v_sub_co  FROM public.subcontractors WHERE id = NEW.subcontractor_id;
  SELECT company_id INTO v_ship_co FROM public.shipments      WHERE id = NEW.shipment_id;
  IF v_sub_co IS DISTINCT FROM NEW.company_id OR v_ship_co IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cross-company subcontracted mission is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subm_enforce_company
  BEFORE INSERT OR UPDATE OF subcontractor_id, shipment_id, company_id ON public.subcontracted_missions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subm_company();

ALTER TABLE public.subcontracted_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subm_super_admin" ON public.subcontracted_missions
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "subm_back_office_select" ON public.subcontracted_missions
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "subm_back_office_write" ON public.subcontracted_missions
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
-- shipments.subcontracted_mission_id — back-link for fast lookup.
-- Keeps shipments→mission O(1) without joining on the unique
-- index. Set NULL on mission delete; the unique constraint on
-- subcontracted_missions.shipment_id remains the source of truth.
-- ============================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS subcontracted_mission_id uuid
    REFERENCES public.subcontracted_missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_subm
  ON public.shipments(subcontracted_mission_id)
  WHERE subcontracted_mission_id IS NOT NULL;

-- ============================================================
-- Storage bucket: mission-orders (private)
--
-- Layout: {company_id}/{mission_id}/{mission_order_number}.pdf
-- Access via signed URLs only (≤ 15 min TTL), generated server-side.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-orders', 'mission-orders', false)
ON CONFLICT (id) DO NOTHING;

-- super_admin: full access across all companies
CREATE POLICY "mission_orders_super_admin" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'mission-orders' AND public.current_user_role() = 'super_admin')
  WITH CHECK (bucket_id = 'mission-orders' AND public.current_user_role() = 'super_admin');

-- back-office (company_admin + dispatcher): read/write within their company.
-- The path's first segment is the company_id (UUID). Anything that doesn't
-- match the user's company is rejected.
CREATE POLICY "mission_orders_back_office_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'mission-orders'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'mission-orders'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- comptable: read-only (margin/cost auditing)
CREATE POLICY "mission_orders_comptable_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mission-orders'
    AND public.current_user_role() = 'comptable'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

COMMIT;
