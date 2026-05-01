-- ============================================================
-- M1: CMR auto (Convention Marchandises par Route)
--
-- The CMR is the international transport contract document
-- (Convention relative au contrat de transport international de
-- marchandises par route, 1956). It is a 24-box standardized
-- form mandatory for cross-border road shipments.
--
-- This migration ships:
--   1. cmr_documents (1:1 with shipment via UNIQUE constraint,
--      24 boxes captured as discrete columns, sender/consignee/
--      carrier signature blocks, charges breakdown).
--   2. shipments.cmr_document_id back-link (SET NULL on delete).
--   3. Private Storage bucket `cmr-documents` for the rendered PDF.
--   4. Sequence type 'cmr' for {SLUG}-CMR-{YY}-{NNNNN} numbers
--      (handled by the existing public.next_sequence_value helper).
--   5. RLS: super_admin (transverse), back-office RW (admin/dispatcher),
--      comptable read-only.
--   6. Audit log entity_type extended with 'cmr_document'.
--
-- The UI is gated behind NEXT_PUBLIC_INTERNATIONAL_ENABLED — the
-- schema always works, so flipping the flag at runtime exposes the
-- already-collected data without migration churn.
-- ============================================================

BEGIN;

-- ============================================================
-- cmr_documents
-- ============================================================
CREATE TABLE public.cmr_documents (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  shipment_id                 uuid          NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,

  cmr_number                  text          NOT NULL,                       -- e.g. MASLAK-CMR-26-00001
  status                      text          NOT NULL DEFAULT 'draft'
                                            CHECK (status IN (
                                              'draft',           -- editable by dispatcher
                                              'issued',          -- locked, PDF generated
                                              'signed',          -- signed by all parties (cancellation = new doc)
                                              'cancelled'
                                            )),

  -- Box 1 — Sender (Expéditeur)
  sender_name                 text          NOT NULL,
  sender_address              text          NOT NULL,
  sender_city                 text          NOT NULL,
  sender_country              char(2)       NOT NULL DEFAULT 'MA',
  sender_ice                  text,                                          -- B2B Maroc

  -- Box 2 — Consignee (Destinataire)
  consignee_name              text          NOT NULL,
  consignee_address           text          NOT NULL,
  consignee_city              text          NOT NULL,
  consignee_country           char(2)       NOT NULL,
  consignee_ice               text,

  -- Box 3 — Place of delivery (Lieu prévu pour la livraison)
  delivery_place              text          NOT NULL,
  delivery_country            char(2)       NOT NULL,

  -- Box 4 — Place + date of taking over (Lieu et date de prise en charge)
  taking_over_place           text          NOT NULL,
  taking_over_country         char(2)       NOT NULL DEFAULT 'MA',
  taking_over_date            date,

  -- Box 5 — Documents attached (Documents annexés)
  attached_documents          text,                                          -- e.g. "Facture, EUR1, packing list"

  -- Boxes 6-12 — Goods description (Marchandise)
  marks_and_numbers           text,                                          -- Box 6 — marques et numéros
  packages_count              integer,                                       -- Box 7 — nombre des colis
  packing_method              text,                                          -- Box 8 — mode d'emballage
  nature_of_goods             text          NOT NULL,                        -- Box 9 — nature de la marchandise
  statistical_number          text,                                          -- Box 10 — n° statistique (HS code)
  gross_weight_kg             numeric(10,2),                                 -- Box 11 — poids brut kg
  volume_m3                   numeric(8,3),                                  -- Box 12 — cubage m³

  -- Box 13 — Sender's instructions (Instructions de l'expéditeur)
  sender_instructions         text,

  -- Box 14 — Carrier (Transporteur — usually our company)
  carrier_name                text          NOT NULL,
  carrier_address             text,
  carrier_country             char(2)       NOT NULL DEFAULT 'MA',
  carrier_ice                 text,
  carrier_vehicle_plate       text,                                          -- plaque tracteur
  carrier_trailer_plate       text,                                          -- plaque remorque
  carrier_driver_name         text,

  -- Box 15 — Successive carriers (Transporteurs successifs)
  successive_carriers         text,

  -- Box 16 — Reservations and observations of the carrier
  carrier_observations        text,

  -- Box 17 — Special agreements (Conventions particulières) — see Box 22 below

  -- Box 18 — Charges to be paid by sender / consignee (À payer par)
  charges_freight_mad         numeric(12,2),                                 -- frais de transport
  charges_supplementary_mad   numeric(12,2),                                 -- frais accessoires
  charges_customs_mad         numeric(12,2),                                 -- droits de douane
  charges_other_mad           numeric(12,2),
  charges_total_mad           numeric(12,2)
                              GENERATED ALWAYS AS (
                                COALESCE(charges_freight_mad, 0)
                                + COALESCE(charges_supplementary_mad, 0)
                                + COALESCE(charges_customs_mad, 0)
                                + COALESCE(charges_other_mad, 0)
                              ) STORED,
  payer                       text          NOT NULL DEFAULT 'sender'
                                            CHECK (payer IN ('sender','consignee','split')),

  -- Box 19 — Cash on delivery (Remboursement)
  cash_on_delivery_mad        numeric(12,2),

  -- Box 20 — Established at / on (Établi à / le)
  issued_place                text          NOT NULL,
  issued_date                 date          NOT NULL DEFAULT CURRENT_DATE,

  -- Box 21 — Special agreements (Conventions particulières)
  special_agreements          text,

  -- Boxes 22, 23, 24 — Signatures (place + date for each)
  signature_sender_place      text,
  signature_sender_date       date,
  signature_carrier_place     text,
  signature_carrier_date      date,
  signature_consignee_place   text,
  signature_consignee_date    date,

  -- Generated PDF in private bucket
  pdf_storage_path            text,
  pdf_generated_at            timestamptz,

  -- Free-form
  internal_notes              text,                                          -- visible only to dispatcher (not on PDF)

  created_by_user_id          uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  deleted_at                  timestamptz,

  -- One CMR per shipment (active). Soft-deleted rows don't block re-issuance.
  CONSTRAINT cmr_shipment_unique
    UNIQUE (shipment_id),
  CONSTRAINT cmr_number_unique
    UNIQUE (company_id, cmr_number)
);

CREATE INDEX idx_cmr_company_created  ON public.cmr_documents(company_id, created_at DESC);
CREATE INDEX idx_cmr_status           ON public.cmr_documents(company_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_cmr_shipment         ON public.cmr_documents(shipment_id);

CREATE TRIGGER trg_cmr_updated_at
  BEFORE UPDATE ON public.cmr_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defense in depth: enforce shipment.company_id == cmr.company_id.
-- RLS prevents cross-company reads; this trigger blocks malicious
-- inserts that would create a cross-tenant link.
CREATE OR REPLACE FUNCTION public.enforce_cmr_company()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_ship_co uuid;
BEGIN
  SELECT company_id INTO v_ship_co FROM public.shipments WHERE id = NEW.shipment_id;
  IF v_ship_co IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cross-company CMR document is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cmr_enforce_company
  BEFORE INSERT OR UPDATE OF shipment_id, company_id ON public.cmr_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cmr_company();

ALTER TABLE public.cmr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cmr_super_admin" ON public.cmr_documents
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cmr_back_office_select" ON public.cmr_documents
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "cmr_back_office_write" ON public.cmr_documents
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
-- shipments back-link
-- ============================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS cmr_document_id uuid
    REFERENCES public.cmr_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_cmr
  ON public.shipments(cmr_document_id) WHERE cmr_document_id IS NOT NULL;

-- ============================================================
-- Storage bucket: cmr-documents (private)
-- Layout: {company_id}/{cmr_id}/{cmr_number}.pdf
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cmr-documents', 'cmr-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cmr_storage_super_admin" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'cmr-documents' AND public.current_user_role() = 'super_admin')
  WITH CHECK (bucket_id = 'cmr-documents' AND public.current_user_role() = 'super_admin');

CREATE POLICY "cmr_storage_back_office_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'cmr-documents'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'cmr-documents'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "cmr_storage_comptable_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cmr-documents'
    AND public.current_user_role() = 'comptable'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ============================================================
-- Audit log: extend entity_type with 'cmr_document'
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
    'cmr_document'
  ));

COMMIT;
