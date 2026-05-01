-- ============================================================
-- Prompt 2 — Audit log TRANSVERSE
--
-- The accounting_audit_log was originally scoped to comptabilité-only
-- entities (accounting_document, monthly_dossier, tax_declaration,
-- payroll_data, accountant_profile). Per Prompt 2 (super_admin total
-- comptabilité), Ahmed needs visibility on every action that has a
-- financial implication, including the operational tickets shipped in
-- Phase B:
--   - subcontracted_mission (margin, PDFs, partner ↔ shipment links)
--   - client_jit_policy (penalty exposure changes)
--   - shipment_customs_document (compliance + financial-document-adjacent)
--   - free_zone, customs_document_type (référentiel)
--   - recurring_schedule (mission generator)
--
-- This migration extends the entity_type CHECK constraint without
-- moving any existing rows. Server Actions in those tickets will start
-- writing audit rows immediately.
-- ============================================================

BEGIN;

ALTER TABLE public.accounting_audit_log
  DROP CONSTRAINT IF EXISTS accounting_audit_log_entity_type_check;

ALTER TABLE public.accounting_audit_log
  ADD CONSTRAINT accounting_audit_log_entity_type_check
  CHECK (entity_type IN (
    -- Original comptabilité entities
    'accounting_document',
    'monthly_dossier',
    'tax_declaration',
    'payroll_data',
    'accountant_profile',
    -- Phase B operational entities (financial impact)
    'subcontracted_mission',
    'subcontractor',
    'client_jit_policy',
    'shipment_customs_document',
    'free_zone',
    'customs_document_type',
    'recurring_schedule'
  ));

COMMIT;
