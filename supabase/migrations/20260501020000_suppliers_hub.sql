-- ============================================================
-- M6: Hub fournisseurs
--
-- Distinct from `subcontractors` (transport partners). `suppliers`
-- represents the recurring goods/services partners — fuel stations,
-- parts vendors, garage / mechanics, insurance, tires, etc.
--
-- Ships:
--   1. suppliers (per-tenant directory, category enum, payment terms)
--   2. supplier_invoices (FK back to accounting_documents per memory
--      cross-ticket integration — same row may be referenced from the
--      comptabilité capture flow). Optional: not every supplier_invoice
--      has a corresponding scanned doc yet.
--   3. supplier_payments (1:N invoices via supplier_invoice_id)
--   4. RLS + audit log entity_type extensions (supplier, supplier_invoice,
--      supplier_payment).
-- ============================================================

BEGIN;

-- ============================================================
-- suppliers
-- ============================================================
CREATE TABLE public.suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  name                text NOT NULL,
  category            text NOT NULL CHECK (category IN (
    'fuel',           -- carburant
    'parts',          -- pièces détachées
    'garage',         -- entretien / réparation
    'tires',          -- pneumatiques
    'insurance',      -- assurance
    'telecom',        -- téléphonie / internet flotte
    'office',         -- fournitures bureau
    'cleaning',       -- nettoyage / lavage
    'other'
  )),
  ice                 text,
  rc_number           text,
  tax_id              text,

  contact_name        text,
  contact_phone       text,
  contact_email       text,
  whatsapp_phone      text,

  address             text,
  city                text,
  postal_code         text,

  bank_name           text,
  bank_iban           text,
  bank_swift          text,
  payment_terms_days  integer NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 180),

  notes               text,
  is_active           boolean NOT NULL DEFAULT true,

  created_by_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX suppliers_company_idx
  ON public.suppliers (company_id, category)
  WHERE deleted_at IS NULL;

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_super_admin" ON public.suppliers
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "suppliers_back_office_read" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "suppliers_back_office_write" ON public.suppliers
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
-- supplier_invoices
-- ============================================================
CREATE TABLE public.supplier_invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id             uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,

  -- Cross-ticket integration: COMPTA-1 captured the scan; this row is
  -- the structured side. Optional 1:1 link.
  accounting_document_id  uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,

  invoice_number          text NOT NULL,
  issued_at               date NOT NULL,
  due_date                date,

  total_excl_tax          numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_excl_tax >= 0),
  vat_amount              numeric(12,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_incl_tax          numeric(12,2) GENERATED ALWAYS AS (total_excl_tax + vat_amount) STORED,
  amount_paid             numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due             numeric(12,2) GENERATED ALWAYS AS (
    (total_excl_tax + vat_amount) - amount_paid
  ) STORED,

  status                  text NOT NULL DEFAULT 'unpaid'
                          CHECK (status IN ('unpaid','partially_paid','paid','overdue','cancelled')),

  notes                   text,
  created_by_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,

  CONSTRAINT supplier_invoices_unique UNIQUE (company_id, supplier_id, invoice_number)
);

CREATE INDEX supplier_invoices_company_idx
  ON public.supplier_invoices (company_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX supplier_invoices_due_date_idx
  ON public.supplier_invoices (company_id, due_date)
  WHERE deleted_at IS NULL AND status IN ('unpaid','partially_paid','overdue');

CREATE TRIGGER supplier_invoices_set_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_invoices_super_admin" ON public.supplier_invoices
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "supplier_invoices_back_office" ON public.supplier_invoices
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
-- supplier_payments — N payments per invoice
-- ============================================================
CREATE TABLE public.supplier_payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_invoice_id     uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,

  amount_mad              numeric(12,2) NOT NULL CHECK (amount_mad > 0),
  paid_at                 date NOT NULL DEFAULT CURRENT_DATE,
  method                  text NOT NULL CHECK (method IN ('cash','transfer','check','card')),
  reference               text,
  notes                   text,

  created_by_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_payments_invoice_idx
  ON public.supplier_payments (supplier_invoice_id, paid_at);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_payments_super_admin" ON public.supplier_payments
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "supplier_payments_back_office" ON public.supplier_payments
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
-- Recompute supplier_invoices.amount_paid + status from payments.
-- Trigger after INSERT/UPDATE/DELETE on supplier_payments.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_supplier_invoice_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_due date;
  v_new_status text;
BEGIN
  v_invoice_id := COALESCE(NEW.supplier_invoice_id, OLD.supplier_invoice_id);
  IF v_invoice_id IS NULL THEN RETURN NULL; END IF;

  SELECT total_incl_tax, due_date INTO v_total, v_due
  FROM public.supplier_invoices WHERE id = v_invoice_id;

  SELECT COALESCE(SUM(amount_mad), 0) INTO v_paid
  FROM public.supplier_payments WHERE supplier_invoice_id = v_invoice_id;

  v_new_status :=
    CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0 THEN 'partially_paid'
      WHEN v_due IS NOT NULL AND v_due < CURRENT_DATE THEN 'overdue'
      ELSE 'unpaid'
    END;

  UPDATE public.supplier_invoices
  SET amount_paid = v_paid,
      status = v_new_status
  WHERE id = v_invoice_id
    AND status NOT IN ('cancelled');

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_supplier_payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_supplier_invoice_balance();

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
    'supplier_payment'
  ));

COMMIT;
