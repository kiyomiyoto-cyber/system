-- ============================================================
-- Work sessions: daily check-in / check-out for team members.
--
-- Team = dispatcher, driver, comptable. Excluded from check-in:
-- super_admin, company_admin (the "admin" who supervises),
-- and client (read-only portal).
--
-- This migration:
--   1. companies — adds office geofence columns (lat/lng/radius_m).
--   2. is_team_member(uuid) — SECURITY DEFINER helper used by RLS.
--   3. work_sessions — one row per shift, with audit GPS for both
--      check-in and check-out, ratings, blockers, notes.
--   4. RLS — staff CRUD their own session within their company;
--      company_admin / super_admin can read all in their company.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Office geofence on companies
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS office_lat       numeric(10,7),
  ADD COLUMN IF NOT EXISTS office_lng       numeric(10,7),
  ADD COLUMN IF NOT EXISTS office_radius_m  integer NOT NULL DEFAULT 200
    CHECK (office_radius_m BETWEEN 25 AND 5000),
  ADD COLUMN IF NOT EXISTS office_label     text,
  ADD COLUMN IF NOT EXISTS office_maps_url  text;

COMMENT ON COLUMN public.companies.office_lat
  IS 'Depot/office latitude — used by the work-session check-in geofence.';
COMMENT ON COLUMN public.companies.office_lng
  IS 'Depot/office longitude — used by the work-session check-in geofence.';
COMMENT ON COLUMN public.companies.office_radius_m
  IS 'Geofence radius in meters around (office_lat, office_lng). Default 200m.';

-- ============================================================
-- 2. is_team_member(uuid) — who must check in to use the app
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id
      AND role IN ('dispatcher', 'driver', 'comptable')
      AND deleted_at IS NULL
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

-- ============================================================
-- 3. work_sessions
-- ============================================================
CREATE TABLE public.work_sessions (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id             uuid          NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  role                text          NOT NULL,

  check_in_at         timestamptz   NOT NULL DEFAULT now(),
  check_out_at        timestamptz,

  check_in_lat        double precision,
  check_in_lng        double precision,
  check_in_accuracy   double precision,

  check_out_lat       double precision,
  check_out_lng       double precision,
  check_out_accuracy  double precision,

  prod_rating         smallint      CHECK (prod_rating IS NULL OR prod_rating BETWEEN 1 AND 5),
  motiv_rating        smallint      CHECK (motiv_rating IS NULL OR motiv_rating BETWEEN 1 AND 5),

  completed_tasks     jsonb         NOT NULL DEFAULT '[]'::jsonb,
  incomplete_tasks    jsonb         NOT NULL DEFAULT '[]'::jsonb,

  blockers            text,
  notes               text,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

CREATE INDEX idx_ws_company_check_in   ON public.work_sessions(company_id, check_in_at DESC);
CREATE INDEX idx_ws_user_check_in      ON public.work_sessions(user_id, check_in_at DESC);
CREATE INDEX idx_ws_check_in           ON public.work_sessions(check_in_at DESC);

-- One open session per user, enforced at the DB level (defense in depth).
CREATE UNIQUE INDEX uniq_ws_one_open_per_user
  ON public.work_sessions(user_id) WHERE check_out_at IS NULL;

CREATE TRIGGER trg_ws_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- super_admin: full access across all companies
CREATE POLICY "ws_super_admin" ON public.work_sessions
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- company_admin: read all, no insert (admins don't check in), can delete bad rows
CREATE POLICY "ws_company_admin_select" ON public.work_sessions
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin')
  );

CREATE POLICY "ws_company_admin_delete" ON public.work_sessions
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin')
  );

-- Staff: read their own rows
CREATE POLICY "ws_self_select" ON public.work_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff: insert their own row, only if they are a team member,
-- and only inside their own company.
CREATE POLICY "ws_self_insert_team" ON public.work_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND public.is_team_member(auth.uid())
  );

-- Staff: update only their own rows (for the check-out)
CREATE POLICY "ws_self_update" ON public.work_sessions
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.work_sessions TO authenticated;
GRANT DELETE                 ON public.work_sessions TO authenticated;

COMMENT ON TABLE public.work_sessions IS
  'Daily check-in / check-out log for staff (dispatcher, driver, comptable). '
  'Admins read all in their company; team writes their own.';

COMMIT;
