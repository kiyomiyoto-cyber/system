-- ============================================================
-- COMPTA-3 / COMPTA-4: monthly_dossiers, accountant_profiles
-- + FK accounting_documents.monthly_dossier_id
-- + private storage bucket monthly-dossiers
-- ============================================================

BEGIN;

-- ============================================================
-- accountant_profiles
-- One row per company. Stores the external accountant contact info
-- and the preferred delivery method (email/usb/paper/portal).
-- ============================================================
CREATE TABLE public.accountant_profiles (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid          NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  accountant_name             text          NOT NULL,
  cabinet_name                text,
  email                       text,
  phone                       text,
  whatsapp_phone              text,
  preferred_delivery_method   text          NOT NULL DEFAULT 'email' CHECK (preferred_delivery_method IN ('email', 'usb', 'paper', 'portal')),
  has_portal_access           boolean       NOT NULL DEFAULT false,
  portal_user_id              uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  billing_terms               text,
  contract_start_date         date,
  notes                       text,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_accountant_profiles_updated_at
  BEFORE UPDATE ON public.accountant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accountant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ap_super_admin" ON public.accountant_profiles
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "ap_back_office_all" ON public.accountant_profiles
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  );

-- ============================================================
-- monthly_dossiers
-- One row per (company, period_month). Generated on demand by an
-- admin or — later — by a cron on the 1st of each month at 8 AM.
-- ============================================================
CREATE TABLE public.monthly_dossiers (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  period_month                date          NOT NULL,

  status                      text          NOT NULL DEFAULT 'in_progress' CHECK (status IN (
                                              'in_progress',
                                              'ready',
                                              'sent',
                                              'closed_by_accountant'
                                            )),

  total_documents_count       integer       NOT NULL DEFAULT 0,
  total_revenue_excl_tax_mad  numeric(14,2) NOT NULL DEFAULT 0,
  total_revenue_incl_tax_mad  numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses_mad          numeric(14,2) NOT NULL DEFAULT 0,

  vat_collected_mad           numeric(14,2) NOT NULL DEFAULT 0,
  vat_deductible_mad          numeric(14,2) NOT NULL DEFAULT 0,
  vat_to_pay_mad              numeric(14,2) NOT NULL DEFAULT 0,

  total_payroll_gross_mad     numeric(14,2) NOT NULL DEFAULT 0,
  total_payroll_net_mad       numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_cost_mad     numeric(14,2) NOT NULL DEFAULT 0,

  -- Generated artefacts (paths inside the monthly-dossiers bucket)
  pdf_summary_path            text,
  zip_archive_path            text,
  excel_export_path           text,

  -- Frozen detail snapshot (jsonb for fast rendering of the detail page)
  computed_snapshot           jsonb,

  generated_at                timestamptz,
  generated_by_user_id        uuid          REFERENCES public.users(id) ON DELETE SET NULL,

  -- Transmission tracking
  sent_at                     timestamptz,
  sent_to_email               text,
  sent_method                 text          CHECK (sent_method IS NULL OR sent_method IN ('email', 'usb', 'paper', 'portal')),

  notes_from_accountant       text,
  closed_at                   timestamptz,

  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE UNIQUE INDEX idx_dossiers_unique
  ON public.monthly_dossiers(company_id, period_month)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dossiers_company_period
  ON public.monthly_dossiers(company_id, period_month DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dossiers_status
  ON public.monthly_dossiers(company_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_dossiers_updated_at
  BEFORE UPDATE ON public.monthly_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.monthly_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dossiers_super_admin" ON public.monthly_dossiers
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "dossiers_back_office_all" ON public.monthly_dossiers
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  );

-- ============================================================
-- accounting_documents.monthly_dossier_id
-- FK back to monthly_dossiers (was deferred from COMPTA-1).
-- Allows querying "all justifs in dossier X" once the dossier is
-- generated.
-- ============================================================
ALTER TABLE public.accounting_documents
  ADD COLUMN monthly_dossier_id uuid
    REFERENCES public.monthly_dossiers(id) ON DELETE SET NULL;

CREATE INDEX idx_acc_docs_dossier_id
  ON public.accounting_documents(monthly_dossier_id)
  WHERE monthly_dossier_id IS NOT NULL;

-- ============================================================
-- STORAGE: monthly-dossiers bucket (private)
-- Path: {company_id}/{YYYY-MM}/{recap|archive|export}.{pdf|zip|xlsx}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'monthly-dossiers',
  'monthly-dossiers',
  false,
  52428800,                                -- 50 MB (PDFs + future ZIPs)
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- super_admin: full bucket access
CREATE POLICY "dossiers_storage_super_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'monthly-dossiers' AND public.current_user_role() = 'super_admin');

CREATE POLICY "dossiers_storage_super_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'monthly-dossiers' AND public.current_user_role() = 'super_admin');

CREATE POLICY "dossiers_storage_super_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'monthly-dossiers' AND public.current_user_role() = 'super_admin');

CREATE POLICY "dossiers_storage_super_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'monthly-dossiers' AND public.current_user_role() = 'super_admin');

-- back-office (company_admin + comptable): full ops within their tenant folder
CREATE POLICY "dossiers_storage_back_office_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'monthly-dossiers'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

CREATE POLICY "dossiers_storage_back_office_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'monthly-dossiers'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

CREATE POLICY "dossiers_storage_back_office_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'monthly-dossiers'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

CREATE POLICY "dossiers_storage_back_office_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'monthly-dossiers'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_any_role('company_admin', 'comptable')
  );

COMMIT;
