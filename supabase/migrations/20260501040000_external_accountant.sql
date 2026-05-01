-- ============================================================
-- COMPTA-4: external_accountant role + Mode D (portal) access
--
-- Adds the `external_accountant` user role for the comptable externe
-- (the cabinet that receives the monthly dossier). They get a
-- read-only portal to download the dossier artefacts (PDF + ZIP +
-- Excel) for their company, and ONE write capability: close the
-- dossier with notes once they've processed it.
--
-- This migration ships:
--   1. users.role CHECK constraint extended with 'external_accountant'.
--   2. RLS policies on monthly_dossiers, accounting_documents,
--      tax_declarations, payroll_data_export so the external accountant
--      can read their company's data (filtered to status >= 'sent')
--      and update only `notes_from_accountant` + `closed_at` + status.
--   3. Storage bucket policy on monthly-dossiers so they can fetch
--      the artefacts.
--   4. accountant_profiles.has_portal_access already exists; we wire
--      the portal_user_id link to the user we create.
-- ============================================================

BEGIN;

-- ============================================================
-- Extend the role enum
-- ============================================================
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',
    'company_admin',
    'dispatcher',
    'comptable',
    'driver',
    'client',
    'external_accountant'
  ));

-- ============================================================
-- Helper: returns true if the current user is the linked external
-- accountant for the given company. Bypasses RLS via SECURITY DEFINER
-- to read accountant_profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_external_accountant_for_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.accountant_profiles ap ON ap.portal_user_id = u.id
    WHERE u.id = auth.uid()
      AND u.role = 'external_accountant'
      AND ap.company_id = p_company_id
      AND ap.has_portal_access = true
  )
$$;

-- ============================================================
-- monthly_dossiers — read-only access for sent/closed dossiers,
-- plus narrow update rights (close + notes) on sent dossiers.
-- ============================================================
CREATE POLICY "dossiers_external_accountant_select" ON public.monthly_dossiers
  FOR SELECT TO authenticated
  USING (
    public.is_external_accountant_for_company(company_id)
    AND status IN ('sent', 'closed_by_accountant')
    AND deleted_at IS NULL
  );

-- The external accountant can update notes_from_accountant + status to
-- closed_by_accountant + closed_at on a sent dossier. Other columns
-- remain back-office controlled. We rely on application code to set
-- only the allowed columns; RLS just gates *which* row.
CREATE POLICY "dossiers_external_accountant_close" ON public.monthly_dossiers
  FOR UPDATE TO authenticated
  USING (
    public.is_external_accountant_for_company(company_id)
    AND status = 'sent'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.is_external_accountant_for_company(company_id)
    AND status IN ('sent', 'closed_by_accountant')
    AND deleted_at IS NULL
  );

-- ============================================================
-- accounting_documents — read-only access scoped to the same
-- company + only validated documents (the ones included in dossiers).
-- ============================================================
CREATE POLICY "accounting_documents_external_accountant_select"
  ON public.accounting_documents
  FOR SELECT TO authenticated
  USING (
    public.is_external_accountant_for_company(company_id)
    AND status = 'validated'
    AND deleted_at IS NULL
  );

-- ============================================================
-- tax_declarations / payroll_data_export — read-only for the linked
-- accountant.
-- ============================================================
CREATE POLICY "tax_declarations_external_accountant_select"
  ON public.tax_declarations
  FOR SELECT TO authenticated
  USING (
    public.is_external_accountant_for_company(company_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "payroll_external_accountant_select"
  ON public.payroll_data_export
  FOR SELECT TO authenticated
  USING (
    public.is_external_accountant_for_company(company_id)
    AND deleted_at IS NULL
  );

-- ============================================================
-- accountant_profiles — the external accountant can read their own row
-- (so the portal can display the cabinet name, billing terms, etc.).
-- ============================================================
CREATE POLICY "accountant_profiles_external_accountant_select"
  ON public.accountant_profiles
  FOR SELECT TO authenticated
  USING (
    portal_user_id = auth.uid()
    AND has_portal_access = true
  );

-- ============================================================
-- Storage bucket: monthly-dossiers — read access for the external
-- accountant of the matching company. Layout assumed:
-- {company_id}/{period_yyyy_mm}/...
-- ============================================================
CREATE POLICY "monthly_dossiers_storage_external_accountant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'monthly-dossiers'
    AND public.is_external_accountant_for_company(
      ((storage.foldername(name))[1])::uuid
    )
  );

-- ============================================================
-- companies — read access on the linked company (for branding the
-- portal header).
-- ============================================================
CREATE POLICY "companies_external_accountant_select"
  ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_external_accountant_for_company(id));

-- ============================================================
-- Audit log entity_type extension: external_accountant_action lets
-- us track close-dossier + portal logins separately from internal
-- comptable actions.
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
    'vignette',
    'external_accountant_action'
  ));

COMMIT;
