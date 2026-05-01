-- ============================================================
-- COMPTA-5: payroll_data_export
-- One row per (company, driver, period_month) — the validated
-- monthly payroll. Drives CNSS/IR declarations (COMPTA-7) once
-- validated, and feeds the monthly accounting dossier (COMPTA-3).
-- ============================================================

BEGIN;

CREATE TABLE public.payroll_data_export (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  driver_id               uuid          NOT NULL REFERENCES public.drivers(id)   ON DELETE RESTRICT,
  period_month            date          NOT NULL,

  -- Gross composition
  gross_salary_mad        numeric(12,2) NOT NULL DEFAULT 0 CHECK (gross_salary_mad >= 0),
  bonuses_mad             numeric(12,2) NOT NULL DEFAULT 0 CHECK (bonuses_mad >= 0),
  -- Deductions (advances paid earlier in the month, etc.)
  deductions_mad          numeric(12,2) NOT NULL DEFAULT 0 CHECK (deductions_mad >= 0),

  -- Informational stats (computed by the dispatcher view, not part of the calc)
  missions_count          integer       NOT NULL DEFAULT 0,
  total_km_driven         numeric(10,2) NOT NULL DEFAULT 0,
  working_days            smallint      NOT NULL DEFAULT 0,
  overtime_hours          numeric(5,2)  NOT NULL DEFAULT 0,

  -- Computed snapshot (frozen at validation time)
  cnss_employee_part      numeric(12,2) NOT NULL DEFAULT 0,
  cnss_employer_part      numeric(12,2) NOT NULL DEFAULT 0,
  amo_employee_part       numeric(12,2) NOT NULL DEFAULT 0,
  amo_employer_part       numeric(12,2) NOT NULL DEFAULT 0,
  family_allowance        numeric(12,2) NOT NULL DEFAULT 0,
  vocational_training     numeric(12,2) NOT NULL DEFAULT 0,
  ir_amount               numeric(12,2) NOT NULL DEFAULT 0,
  net_salary_mad          numeric(12,2) NOT NULL DEFAULT 0,

  status                  text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'paid')),
  validated_at            timestamptz,
  validated_by_user_id    uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  payment_date            date,

  notes                   text,

  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE UNIQUE INDEX idx_payroll_unique
  ON public.payroll_data_export(company_id, driver_id, period_month)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_payroll_company_period
  ON public.payroll_data_export(company_id, period_month DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_payroll_driver
  ON public.payroll_data_export(driver_id, period_month DESC);

CREATE INDEX idx_payroll_status
  ON public.payroll_data_export(company_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_payroll_updated_at
  BEFORE UPDATE ON public.payroll_data_export
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payroll_data_export ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_super_admin" ON public.payroll_data_export
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "payroll_back_office_all" ON public.payroll_data_export
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'comptable')
  );

-- driver: can read their own line (for the future driver portal)
CREATE POLICY "payroll_driver_self_select" ON public.payroll_data_export
  FOR SELECT TO authenticated
  USING (
    driver_id = public.current_driver_id()
    AND public.current_user_role() = 'driver'
  );

COMMIT;
