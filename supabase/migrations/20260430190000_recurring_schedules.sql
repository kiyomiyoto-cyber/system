-- ============================================================
-- N-2: recurring_schedules + generator function
--
-- MASLAK runs 1–3 missions/day on a small set of axes (Tanger ↔ Kénitra
-- ↔ Tiflet) for 5 named clients, with weekly cadence (e.g. TESCA
-- Mon/Wed/Fri Tanger → Kénitra at 06:00). Dispatcher should not have
-- to recreate them every Monday by hand.
--
-- This migration:
--   1. recurring_schedules — declarative weekly templates per client.
--   2. shipments.created_from_schedule_id — back-link for traceability.
--   3. public.generate_recurring_shipments(...) — idempotent generator
--      that creates `shipments` rows for every (schedule × matching
--      day) inside a date window, skipping any (schedule, scheduled
--      date) pair that already exists. Called by an Edge Function
--      cron every Friday 18:00 (Africa/Casablanca) for the upcoming
--      Mon–Sun, and exposable as a manual button.
-- ============================================================

BEGIN;

-- ============================================================
-- recurring_schedules
-- ============================================================
CREATE TABLE public.recurring_schedules (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id               uuid          NOT NULL REFERENCES public.clients(id)   ON DELETE RESTRICT,

  name                    text          NOT NULL,                  -- e.g. "TESCA Lun/Mer/Ven matin"
  is_active               boolean       NOT NULL DEFAULT true,

  -- ISO weekday: 1 = Monday … 7 = Sunday
  days_of_week            smallint[]    NOT NULL CHECK (
                                          array_length(days_of_week, 1) BETWEEN 1 AND 7
                                          AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
                                        ),

  pickup_time             time          NOT NULL DEFAULT '06:00',
  -- Optional ETA delta added to pickup_time for delivery_scheduled_at.
  -- Stored in minutes; NULL means "leave delivery time blank on generated shipment".
  delivery_offset_minutes integer       CHECK (delivery_offset_minutes IS NULL OR delivery_offset_minutes BETWEEN 0 AND 24*60),

  -- Pickup
  pickup_street           text          NOT NULL,
  pickup_city             text          NOT NULL,
  pickup_postal_code      text,
  pickup_lat              numeric(10,7),
  pickup_lng              numeric(10,7),
  pickup_contact_name     text,
  pickup_contact_phone    text,

  -- Delivery
  delivery_street         text          NOT NULL,
  delivery_city           text          NOT NULL,
  delivery_postal_code    text,
  delivery_lat            numeric(10,7),
  delivery_lng            numeric(10,7),
  delivery_contact_name   text,
  delivery_contact_phone  text,

  -- Defaults applied when generating shipments
  default_driver_id       uuid          REFERENCES public.drivers(id)  ON DELETE SET NULL,
  default_vehicle_id      uuid          REFERENCES public.vehicles(id) ON DELETE SET NULL,
  default_vehicle_type    text          CHECK (default_vehicle_type IS NULL OR default_vehicle_type IN (
                                          'motorcycle', 'van', 'truck', 'pickup'
                                        )),

  -- Optional date bounds — leave NULL for open-ended.
  valid_from              date          NOT NULL DEFAULT CURRENT_DATE,
  valid_to                date,

  notes                   text,

  -- Telemetry — set by the generator on each run.
  last_generated_through  date,                                    -- last date inclusive that has been generated
  last_generated_at       timestamptz,
  last_generated_count    integer,

  created_by_user_id      uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz,

  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_rs_company       ON public.recurring_schedules(company_id);
CREATE INDEX idx_rs_client        ON public.recurring_schedules(client_id);
CREATE INDEX idx_rs_active_window ON public.recurring_schedules(company_id, is_active, valid_from, valid_to)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_rs_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_super_admin" ON public.recurring_schedules
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "rs_back_office_all" ON public.recurring_schedules
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
-- shipments.created_from_schedule_id — back-link for traceability
-- (and idempotency of the generator).
-- ============================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS created_from_schedule_id uuid
    REFERENCES public.recurring_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_run_date date;

CREATE INDEX IF NOT EXISTS idx_shipments_schedule_run
  ON public.shipments(created_from_schedule_id, scheduled_run_date)
  WHERE created_from_schedule_id IS NOT NULL AND deleted_at IS NULL;

-- One generated row per (schedule, day) — guarantees idempotency
-- regardless of what application code does.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shipments_schedule_run
  ON public.shipments(created_from_schedule_id, scheduled_run_date)
  WHERE created_from_schedule_id IS NOT NULL;

-- ============================================================
-- generate_recurring_shipments(company_id, window_start, window_end)
--
-- Inserts one shipment per (active schedule × matching weekday) inside
-- [window_start, window_end] (both inclusive). If a row already exists
-- for that (schedule, date) pair, the unique index swallows the insert
-- via ON CONFLICT DO NOTHING — so the function is safe to re-run.
--
-- Returns the number of shipments actually inserted.
--
-- SECURITY DEFINER so the cron Edge Function (service role) can invoke
-- it for every company without a session-level company_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_recurring_shipments(
  p_company_id    uuid,
  p_window_start  date,
  p_window_end    date
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted_count integer := 0;
  v_schedule       RECORD;
  v_day            date;
  v_dow            smallint;
  v_company_slug   text;
  v_company_tz     text;
  v_seq            integer;
  v_year_short     text := to_char(CURRENT_DATE, 'YY');
  v_pickup_ts      timestamptz;
  v_delivery_ts    timestamptz;
  v_inserted_id    uuid;
BEGIN
  IF p_window_start IS NULL OR p_window_end IS NULL OR p_window_end < p_window_start THEN
    RAISE EXCEPTION 'Invalid window: start=%, end=%', p_window_start, p_window_end;
  END IF;

  SELECT slug, timezone INTO v_company_slug, v_company_tz
  FROM public.companies
  WHERE id = p_company_id;
  IF v_company_slug IS NULL THEN
    RAISE EXCEPTION 'Unknown company %', p_company_id;
  END IF;

  FOR v_schedule IN
    SELECT *
    FROM public.recurring_schedules
    WHERE company_id = p_company_id
      AND is_active = true
      AND deleted_at IS NULL
      AND valid_from <= p_window_end
      AND (valid_to IS NULL OR valid_to >= p_window_start)
  LOOP
    v_day := GREATEST(v_schedule.valid_from, p_window_start);
    WHILE v_day <= LEAST(p_window_end, COALESCE(v_schedule.valid_to, p_window_end)) LOOP
      -- ISO dow: Mon=1 … Sun=7
      v_dow := EXTRACT(ISODOW FROM v_day)::smallint;

      IF v_dow = ANY(v_schedule.days_of_week) THEN
        -- Build timestamps in the company's timezone (Africa/Casablanca by default)
        v_pickup_ts := (v_day::timestamp + v_schedule.pickup_time) AT TIME ZONE v_company_tz;
        v_delivery_ts := CASE
          WHEN v_schedule.delivery_offset_minutes IS NULL THEN NULL
          ELSE v_pickup_ts + (v_schedule.delivery_offset_minutes * INTERVAL '1 minute')
        END;

        v_seq := public.next_sequence_value(p_company_id, 'shipment');

        INSERT INTO public.shipments (
          company_id, reference, client_id,
          assigned_driver_id, assigned_vehicle_id,
          status,
          pickup_street, pickup_city, pickup_postal_code,
          pickup_lat, pickup_lng,
          pickup_contact_name, pickup_contact_phone,
          pickup_scheduled_at,
          delivery_street, delivery_city, delivery_postal_code,
          delivery_lat, delivery_lng,
          delivery_contact_name, delivery_contact_phone,
          delivery_scheduled_at,
          created_from_schedule_id,
          scheduled_run_date,
          created_by
        ) VALUES (
          p_company_id,
          upper(v_company_slug) || '-EXP-' || v_year_short || '-' || lpad(v_seq::text, 5, '0'),
          v_schedule.client_id,
          v_schedule.default_driver_id,
          v_schedule.default_vehicle_id,
          CASE WHEN v_schedule.default_driver_id IS NOT NULL THEN 'assigned' ELSE 'created' END,
          v_schedule.pickup_street, v_schedule.pickup_city, v_schedule.pickup_postal_code,
          v_schedule.pickup_lat, v_schedule.pickup_lng,
          v_schedule.pickup_contact_name, v_schedule.pickup_contact_phone,
          v_pickup_ts,
          v_schedule.delivery_street, v_schedule.delivery_city, v_schedule.delivery_postal_code,
          v_schedule.delivery_lat, v_schedule.delivery_lng,
          v_schedule.delivery_contact_name, v_schedule.delivery_contact_phone,
          v_delivery_ts,
          v_schedule.id,
          v_day,
          v_schedule.created_by_user_id
        )
        ON CONFLICT (created_from_schedule_id, scheduled_run_date)
          WHERE created_from_schedule_id IS NOT NULL
        DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
          v_inserted_count := v_inserted_count + 1;
        END IF;
        v_inserted_id := NULL;
      END IF;

      v_day := v_day + INTERVAL '1 day';
    END LOOP;

    UPDATE public.recurring_schedules
    SET
      last_generated_through = GREATEST(COALESCE(last_generated_through, p_window_end), p_window_end),
      last_generated_at = now(),
      last_generated_count = v_inserted_count
    WHERE id = v_schedule.id;
  END LOOP;

  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_shipments(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurring_shipments(uuid, date, date) TO authenticated, service_role;

COMMIT;
