-- ============================================================
-- COMPTA-1: accounting_documents
-- Catalog of every receipt / invoice / fuel ticket / supplier doc.
-- Mobile-first capture flow: dispatcher / driver / admin scan a
-- ticket, the row is created with status = 'pending_review' and the
-- file is uploaded to the private 'accounting-documents' bucket.
--
-- monthly_dossier_id will be added by a future migration (COMPTA-3),
-- once the monthly_dossiers table exists.
-- ============================================================

BEGIN;

CREATE TABLE public.accounting_documents (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  -- Categorization
  document_category       text          NOT NULL CHECK (document_category IN (
                                          'invoice_client',
                                          'invoice_supplier',
                                          'fuel_receipt',
                                          'toll_receipt',
                                          'maintenance_receipt',
                                          'driver_advance',
                                          'salary_slip',
                                          'cnss_payment',
                                          'ir_payment',
                                          'phone_internet',
                                          'office_rent',
                                          'insurance',
                                          'bank_statement',
                                          'bank_fee',
                                          'other'
                                        )),
  subcategory             text,

  -- Amounts (HT/TVA may be NULL at capture time; filled by admin/comptable later)
  amount_ttc              numeric(12,2) NOT NULL CHECK (amount_ttc >= 0),
  amount_ht               numeric(12,2) CHECK (amount_ht IS NULL OR amount_ht >= 0),
  vat_amount              numeric(12,2) CHECK (vat_amount IS NULL OR vat_amount >= 0),
  vat_rate                numeric(5,2)  NOT NULL DEFAULT 20.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),

  -- Supplier (free text — populated later if not on receipt)
  supplier_name           text,
  supplier_ice            text,

  -- Dates
  document_date           date,                                 -- date on the document itself
  payment_date            date,
  payment_method          text          CHECK (payment_method IS NULL OR payment_method IN (
                                          'cash', 'transfer', 'check', 'card'
                                        )),

  -- File
  file_path               text          NOT NULL,               -- path inside the 'accounting-documents' bucket
  file_type               text          NOT NULL CHECK (file_type IN ('pdf', 'image', 'scanned')),
  file_mime               text          NOT NULL,
  file_size_bytes         integer       NOT NULL CHECK (file_size_bytes > 0),

  -- Cross-links (frais traçables par mission / véhicule / chauffeur)
  linked_shipment_id      uuid          REFERENCES public.shipments(id) ON DELETE SET NULL,
  linked_vehicle_id       uuid          REFERENCES public.vehicles(id)  ON DELETE SET NULL,
  linked_driver_id        uuid          REFERENCES public.drivers(id)   ON DELETE SET NULL,

  -- Lifecycle
  status                  text          NOT NULL DEFAULT 'pending_review' CHECK (status IN (
                                          'pending_review',
                                          'validated',
                                          'sent_to_accountant',
                                          'archived',
                                          'rejected'
                                        )),
  rejection_reason        text,

  -- Audit
  captured_by_user_id     uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  captured_at             timestamptz   NOT NULL DEFAULT now(),
  validated_by_user_id    uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  validated_at            timestamptz,

  notes                   text,

  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

-- Defense-in-depth: a row's vehicle / driver / shipment must belong
-- to the same company. RLS already prevents cross-tenant reads/writes,
-- but a UI bug should not be the first layer to break this.
CREATE OR REPLACE FUNCTION public.assert_accounting_doc_tenant_consistency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_other_company uuid;
BEGIN
  IF NEW.linked_vehicle_id IS NOT NULL THEN
    SELECT company_id INTO v_other_company FROM public.vehicles WHERE id = NEW.linked_vehicle_id;
    IF v_other_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'linked_vehicle_id belongs to a different company';
    END IF;
  END IF;
  IF NEW.linked_driver_id IS NOT NULL THEN
    SELECT company_id INTO v_other_company FROM public.drivers WHERE id = NEW.linked_driver_id;
    IF v_other_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'linked_driver_id belongs to a different company';
    END IF;
  END IF;
  IF NEW.linked_shipment_id IS NOT NULL THEN
    SELECT company_id INTO v_other_company FROM public.shipments WHERE id = NEW.linked_shipment_id;
    IF v_other_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'linked_shipment_id belongs to a different company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_documents_tenant_check
  BEFORE INSERT OR UPDATE ON public.accounting_documents
  FOR EACH ROW EXECUTE FUNCTION public.assert_accounting_doc_tenant_consistency();

CREATE TRIGGER trg_accounting_documents_updated_at
  BEFORE UPDATE ON public.accounting_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_acc_docs_company_id        ON public.accounting_documents(company_id);
CREATE INDEX idx_acc_docs_company_month     ON public.accounting_documents(company_id, document_date)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_acc_docs_pending_review    ON public.accounting_documents(company_id, captured_at DESC)
  WHERE status = 'pending_review' AND deleted_at IS NULL;
CREATE INDEX idx_acc_docs_captured_by       ON public.accounting_documents(captured_by_user_id);
CREATE INDEX idx_acc_docs_linked_vehicle    ON public.accounting_documents(linked_vehicle_id)
  WHERE linked_vehicle_id IS NOT NULL;
CREATE INDEX idx_acc_docs_linked_driver     ON public.accounting_documents(linked_driver_id)
  WHERE linked_driver_id IS NOT NULL;
CREATE INDEX idx_acc_docs_linked_shipment   ON public.accounting_documents(linked_shipment_id)
  WHERE linked_shipment_id IS NOT NULL;
CREATE INDEX idx_acc_docs_category          ON public.accounting_documents(company_id, document_category)
  WHERE deleted_at IS NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;

-- super_admin: full access
CREATE POLICY "acc_docs_super_admin" ON public.accounting_documents
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- company_admin, comptable, dispatcher: full CRUD within their company
CREATE POLICY "acc_docs_back_office_all" ON public.accounting_documents
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable', 'dispatcher')
  );

-- driver: can INSERT receipts they captured themselves (fuel, tolls, advances)
CREATE POLICY "acc_docs_driver_insert" ON public.accounting_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND captured_by_user_id = auth.uid()
    AND status = 'pending_review'
  );

-- driver: can SELECT only their own captures
CREATE POLICY "acc_docs_driver_select_own" ON public.accounting_documents
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'driver'
    AND captured_by_user_id = auth.uid()
  );

-- ============================================================
-- STORAGE BUCKET
-- Private bucket. Files served only via signed URLs generated by the
-- service client (server-side, short TTL).
-- Path convention: {company_id}/{YYYY}/{MM}/{document_id}.{ext}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting-documents',
  'accounting-documents',
  false,
  10485760,                                  -- 10 MB (matches CLAUDE.md upload limit)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only authenticated users in the right tenant can write,
-- and only via paths that begin with their company_id. Reads happen
-- exclusively through signed URLs (service client), so we keep the
-- direct-read policy narrow to back-office roles for emergency UI.

-- INSERT: company_id (first path segment) must match current user's tenant
CREATE POLICY "acc_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'accounting-documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable', 'dispatcher', 'driver')
  );

-- SELECT direct (rare — most reads go via signed URL): back-office only
CREATE POLICY "acc_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable', 'dispatcher')
  );

-- UPDATE / DELETE: back-office only (drivers can't tamper with their captures)
CREATE POLICY "acc_docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

CREATE POLICY "acc_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

COMMIT;
