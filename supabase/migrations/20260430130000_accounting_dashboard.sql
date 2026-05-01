-- ============================================================
-- COMPTA-2: dashboard, validation workflow, audit log
--
-- Adds:
--   1. super_admin policies on the accounting-documents storage bucket
--      (Prompt 2: super_admin must reach every accounting object).
--   2. accounting_audit_log: chronological feed of every mutation on
--      accounting_documents (validate / reject / complete / delete /
--      capture). Captures actor, before/after JSONB, IP, user-agent.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Storage RLS — super_admin coverage
-- ============================================================
CREATE POLICY "acc_docs_storage_select_super_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND public.current_user_role() = 'super_admin'
  );

CREATE POLICY "acc_docs_storage_insert_super_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'accounting-documents'
    AND public.current_user_role() = 'super_admin'
  );

CREATE POLICY "acc_docs_storage_update_super_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND public.current_user_role() = 'super_admin'
  );

CREATE POLICY "acc_docs_storage_delete_super_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- 2. accounting_audit_log
-- One row per mutation. Server Actions explicitly insert rows
-- with full request context (IP, user-agent). A DB-side trigger
-- can be added later as a safety net if direct DB writes ever
-- become a concern.
-- ============================================================
CREATE TABLE public.accounting_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  entity_type     text        NOT NULL CHECK (entity_type IN (
                                'accounting_document',
                                'monthly_dossier',
                                'tax_declaration',
                                'payroll_data',
                                'accountant_profile'
                              )),
  entity_id       uuid        NOT NULL,

  action          text        NOT NULL CHECK (action IN (
                                'create',
                                'update',
                                'validate',
                                'reject',
                                'complete',
                                'delete',
                                'send',
                                'archive'
                              )),

  before_state    jsonb,                                    -- NULL on 'create'
  after_state     jsonb,                                    -- NULL on 'delete'
  notes           text,                                     -- e.g. rejection reason

  -- Actor
  actor_user_id   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role      text,                                     -- snapshot at time of action
  actor_name      text,                                     -- snapshot to keep the log readable after deletions

  -- Request context (NULL when performed via cron / DB-direct)
  ip_address      inet,
  user_agent      text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aal_company_created   ON public.accounting_audit_log(company_id, created_at DESC);
CREATE INDEX idx_aal_entity            ON public.accounting_audit_log(entity_type, entity_id);
CREATE INDEX idx_aal_actor             ON public.accounting_audit_log(actor_user_id);
CREATE INDEX idx_aal_action            ON public.accounting_audit_log(company_id, action, created_at DESC);

ALTER TABLE public.accounting_audit_log ENABLE ROW LEVEL SECURITY;

-- super_admin: full read/write across all companies
CREATE POLICY "aal_super_admin" ON public.accounting_audit_log
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- company_admin + comptable: read all, write append-only (handled by Server Actions)
CREATE POLICY "aal_back_office_select" ON public.accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  );

CREATE POLICY "aal_back_office_insert" ON public.accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable', 'dispatcher')
  );

-- dispatcher / driver: insert their own actions only (capture event)
CREATE POLICY "aal_capture_insert" ON public.accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('dispatcher', 'driver')
    AND actor_user_id = auth.uid()
  );

-- The audit log is append-only by design. UPDATE / DELETE are
-- intentionally NOT granted to anyone except super_admin (already
-- covered above by `aal_super_admin`).

COMMIT;
