-- ============================================================
-- COMPTA-6 / COMPTA-7: tax_declarations
-- Tracks VAT, IR (income tax) and CNSS (social security) periodic
-- declarations. One row per (company, declaration_type, period).
-- ============================================================

BEGIN;

CREATE TABLE public.tax_declarations (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  declaration_type        text          NOT NULL CHECK (declaration_type IN ('vat', 'ir', 'cnss')),
  -- Period anchor: 1st of the month being declared. Quarter / year
  -- declarations can use the first month of the period.
  period_month            date          NOT NULL,
  period_quarter          smallint      CHECK (period_quarter IS NULL OR period_quarter BETWEEN 1 AND 4),

  amount_due              numeric(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid             numeric(12,2),

  status                  text          NOT NULL DEFAULT 'pending' CHECK (status IN (
                                          'pending',     -- computed but not declared
                                          'declared',    -- declared at DGI/CNSS, not yet paid
                                          'paid',        -- declared + paid
                                          'overdue'      -- past deadline, not declared
                                        )),

  declaration_date        date,
  payment_date            date,
  declaration_reference   text,                                  -- DGI / CNSS receipt number

  -- Frozen snapshot of the calculation at declaration time.
  -- Lets us reproduce exactly what was reported even if accounting
  -- documents are edited later.
  computed_snapshot       jsonb,
  -- jsonb array of accounting_documents.id used to support the figure.
  supporting_documents    jsonb         NOT NULL DEFAULT '[]'::jsonb,

  declared_by_user_id     uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  notes                   text,

  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE UNIQUE INDEX idx_tax_decl_unique
  ON public.tax_declarations(company_id, declaration_type, period_month)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_decl_company_period
  ON public.tax_declarations(company_id, declaration_type, period_month DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_decl_status
  ON public.tax_declarations(company_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tax_declarations_updated_at
  BEFORE UPDATE ON public.tax_declarations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_decl_super_admin" ON public.tax_declarations
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "tax_decl_back_office_all" ON public.tax_declarations
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  );

-- dispatcher: read-only (so they can see if a deadline is missed)
CREATE POLICY "tax_decl_dispatcher_select" ON public.tax_declarations
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_role() = 'dispatcher'
  );

COMMIT;
