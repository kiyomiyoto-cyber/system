-- ============================================================
-- N-4: Just-in-Time / flux tendu
--
-- Automotive customers (TESCA, SAGE) impose strict delivery windows
-- with cash penalties when missions arrive late. The schema needs to:
--   1. Capture the per-client policy (strict flag, penalty per hour,
--      grace period in minutes).
--   2. Snapshot that policy onto each shipment at creation, so future
--      changes to the client record don't retroactively rewrite past
--      missions' financial exposure.
--   3. Compute lateness and penalty automatically when the driver
--      marks the shipment as delivered. Application code shouldn't
--      have to remember.
--   4. Expose a view (`v_jit_at_risk`) the dispatcher dashboard can
--      query for upcoming/late missions.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Per-client JIT policy
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS delivery_window_strict     boolean         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_penalty_per_hour_mad  numeric(12,2)   NOT NULL DEFAULT 0
    CHECK (late_penalty_per_hour_mad >= 0),
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes     integer         NOT NULL DEFAULT 0
    CHECK (late_tolerance_minutes BETWEEN 0 AND 720);

COMMENT ON COLUMN public.clients.delivery_window_strict IS
  'When true, every shipment for this client is JIT-strict: a deadline equal to delivery_scheduled_at is snapshotted and a per-hour penalty applies after the tolerance grace.';
COMMENT ON COLUMN public.clients.late_penalty_per_hour_mad IS
  'MAD invoiced to the carrier (us) for each STARTED hour of lateness past the tolerance. Example: TESCA = 5000, SAGE = 3000.';
COMMENT ON COLUMN public.clients.late_tolerance_minutes IS
  'Grace period before the penalty kicks in. 0 = strict to the minute.';

-- ============================================================
-- 2. Per-shipment JIT snapshot + result
-- ============================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS is_jit                     boolean         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_deadline_at       timestamptz,
  ADD COLUMN IF NOT EXISTS late_penalty_per_hour_mad  numeric(12,2),
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes     integer,
  -- Computed at delivery (trigger):
  ADD COLUMN IF NOT EXISTS lateness_minutes           integer,
  ADD COLUMN IF NOT EXISTS late_penalty_mad           numeric(12,2),
  ADD COLUMN IF NOT EXISTS lateness_computed_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_shipments_jit_at_risk
  ON public.shipments(company_id, delivery_deadline_at)
  WHERE is_jit = true
    AND deleted_at IS NULL
    AND status NOT IN ('delivered', 'cancelled', 'failed');

CREATE INDEX IF NOT EXISTS idx_shipments_late_penalty
  ON public.shipments(company_id, delivery_deadline_at DESC)
  WHERE late_penalty_mad IS NOT NULL AND late_penalty_mad > 0;

-- ============================================================
-- 3. Snapshot trigger: on INSERT, freeze the client's JIT policy
-- onto the shipment so retroactive client edits don't change the
-- contractual exposure of past missions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_jit_policy_on_shipment_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_strict      boolean;
  v_penalty     numeric(12,2);
  v_tolerance   integer;
BEGIN
  -- Only snapshot if the row didn't already provide a value
  -- (lets backfill scripts and migrations preserve historical data).
  IF NEW.is_jit IS NULL OR NEW.is_jit = false THEN
    SELECT delivery_window_strict, late_penalty_per_hour_mad, late_tolerance_minutes
      INTO v_strict, v_penalty, v_tolerance
    FROM public.clients
    WHERE id = NEW.client_id;

    IF COALESCE(v_strict, false) THEN
      NEW.is_jit := true;
      IF NEW.late_penalty_per_hour_mad IS NULL THEN
        NEW.late_penalty_per_hour_mad := COALESCE(v_penalty, 0);
      END IF;
      IF NEW.late_tolerance_minutes IS NULL THEN
        NEW.late_tolerance_minutes := COALESCE(v_tolerance, 0);
      END IF;
      -- Default deadline = the scheduled delivery time. The dispatcher
      -- can override it after creation if the contract negotiates a
      -- different cutoff (rare).
      IF NEW.delivery_deadline_at IS NULL AND NEW.delivery_scheduled_at IS NOT NULL THEN
        NEW.delivery_deadline_at := NEW.delivery_scheduled_at;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_snapshot_jit ON public.shipments;
CREATE TRIGGER trg_shipments_snapshot_jit
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_jit_policy_on_shipment_insert();

-- ============================================================
-- 4. Lateness computation: when the row transitions to 'delivered'
-- with a delivery_actual_at, compute lateness_minutes and the
-- penalty (rounded UP to the next started hour past the grace).
-- Idempotent — safe to fire multiple times.
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_shipment_lateness()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_diff_minutes  integer;
  v_grace         integer;
  v_billable      integer;
  v_hours         integer;
  v_per_hour      numeric(12,2);
BEGIN
  -- Only relevant for JIT-strict shipments that have a deadline + actual
  IF NEW.is_jit IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF NEW.delivery_deadline_at IS NULL OR NEW.delivery_actual_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> 'delivered' THEN RETURN NEW; END IF;

  v_diff_minutes := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (NEW.delivery_actual_at - NEW.delivery_deadline_at)) / 60.0)::integer
  );
  v_grace        := COALESCE(NEW.late_tolerance_minutes, 0);
  v_billable     := GREATEST(0, v_diff_minutes - v_grace);
  v_per_hour     := COALESCE(NEW.late_penalty_per_hour_mad, 0);

  IF v_billable = 0 THEN
    NEW.lateness_minutes      := v_diff_minutes;
    NEW.late_penalty_mad      := 0;
  ELSE
    -- Round UP to the next started hour
    v_hours := CEIL(v_billable::numeric / 60.0)::integer;
    NEW.lateness_minutes      := v_diff_minutes;
    NEW.late_penalty_mad      := v_hours * v_per_hour;
  END IF;
  NEW.lateness_computed_at    := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_compute_lateness ON public.shipments;
CREATE TRIGGER trg_shipments_compute_lateness
  BEFORE UPDATE OF status, delivery_actual_at, delivery_deadline_at, late_penalty_per_hour_mad, late_tolerance_minutes
  ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.compute_shipment_lateness();

-- ============================================================
-- 5. Dispatcher dashboard view: missions JIT à risque.
--
-- Returns active JIT shipments (not delivered/cancelled/failed) plus
-- their projected risk band so the dashboard can color-code them:
--   - 'late'        : deadline already passed
--   - 'critical'    : ≤ 1 h before deadline
--   - 'warning'     : ≤ 4 h before deadline
--   - 'on_track'    : > 4 h before deadline
-- ============================================================
CREATE OR REPLACE VIEW public.v_jit_at_risk AS
SELECT
  s.id,
  s.company_id,
  s.reference,
  s.client_id,
  c.business_name                                     AS client_name,
  s.status,
  s.pickup_city,
  s.delivery_city,
  s.delivery_scheduled_at,
  s.delivery_deadline_at,
  s.late_penalty_per_hour_mad,
  s.late_tolerance_minutes,
  s.assigned_driver_id,
  s.assigned_vehicle_id,
  CASE
    WHEN s.delivery_deadline_at IS NULL                       THEN 'no_deadline'
    WHEN s.delivery_deadline_at <  now()                      THEN 'late'
    WHEN s.delivery_deadline_at <= now() + INTERVAL '1 hour'  THEN 'critical'
    WHEN s.delivery_deadline_at <= now() + INTERVAL '4 hours' THEN 'warning'
    ELSE 'on_track'
  END                                                 AS risk_band,
  GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (now() - s.delivery_deadline_at)) / 60.0)::integer
  )                                                   AS minutes_late_now
FROM public.shipments s
LEFT JOIN public.clients c ON c.id = s.client_id
WHERE s.is_jit = true
  AND s.deleted_at IS NULL
  AND s.status NOT IN ('delivered', 'cancelled', 'failed');

GRANT SELECT ON public.v_jit_at_risk TO authenticated, service_role;

-- ============================================================
-- 6. Seed-friendly: flag the two strict clients for the demo company
-- IF AND ONLY IF they exist by exact business_name. This is a no-op
-- on fresh installs (the seed.sql doesn't ship client rows).
-- ============================================================
DO $$
BEGIN
  -- TESCA: 5 000 MAD/h, no grace
  UPDATE public.clients
  SET delivery_window_strict    = true,
      late_penalty_per_hour_mad = 5000,
      late_tolerance_minutes    = 0
  WHERE business_name ILIKE 'TESCA%'
    AND deleted_at IS NULL;

  -- SAGE: 3 000 MAD/h, no grace
  UPDATE public.clients
  SET delivery_window_strict    = true,
      late_penalty_per_hour_mad = 3000,
      late_tolerance_minutes    = 0
  WHERE business_name ILIKE 'SAGE%'
    AND deleted_at IS NULL;
END;
$$;

COMMIT;
