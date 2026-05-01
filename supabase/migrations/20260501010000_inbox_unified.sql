-- ============================================================
-- M3: Inbox unifiée
--
-- Unified outbound communications view: aggregates `notifications`
-- (email + sms via NotificationProvider) and `whatsapp_send_log`
-- (M2 manual deeplinks) into a single chronological feed scoped
-- by company_id.
--
-- Adds `inbox_reads` (per-user read receipts) so dispatchers can
-- mark messages as reviewed without altering the source rows.
--
-- Read-only view; the writes happen on the underlying tables.
-- ============================================================

BEGIN;

-- ============================================================
-- inbox_reads — per-user read marker keyed by (kind, source_id)
-- ============================================================
CREATE TABLE public.inbox_reads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('whatsapp_out','notification_out')),
  source_id    uuid NOT NULL,
  read_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inbox_reads_unique UNIQUE (user_id, kind, source_id)
);

CREATE INDEX inbox_reads_company_user_idx ON public.inbox_reads (company_id, user_id);

ALTER TABLE public.inbox_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_reads_super_admin" ON public.inbox_reads
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "inbox_reads_self" ON public.inbox_reads
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

-- ============================================================
-- v_inbox_unified — chronological feed with normalized columns
--
-- Note: SECURITY INVOKER (default) — reads underlying tables, so
-- existing RLS on `notifications` and `whatsapp_send_log` enforces
-- tenant isolation.
-- ============================================================
CREATE OR REPLACE VIEW public.v_inbox_unified AS
  SELECT
    ('whatsapp_out:' || w.id)::text   AS feed_id,
    'whatsapp_out'::text              AS kind,
    'out'::text                       AS direction,
    w.id                              AS source_id,
    w.company_id,
    w.audience,
    w.recipient_phone                 AS recipient,
    w.recipient_name,
    NULL::text                        AS subject,
    w.body_rendered                   AS body,
    w.template_key,
    w.shipment_id,
    w.client_id,
    w.driver_id,
    w.subcontractor_id,
    NULL::uuid                        AS invoice_id,
    'sent'::text                      AS status,
    NULL::text                        AS error_message,
    w.sent_at                         AS occurred_at,
    w.sent_by_user_id                 AS actor_user_id
  FROM public.whatsapp_send_log w

  UNION ALL

  SELECT
    ('notification_out:' || n.id)::text     AS feed_id,
    'notification_out'::text                AS kind,
    'out'::text                             AS direction,
    n.id                                    AS source_id,
    n.company_id,
    -- audience inferred from channel (notifications table doesn't store it)
    CASE
      WHEN n.channel = 'whatsapp' THEN 'driver'
      ELSE 'client'
    END                                     AS audience,
    COALESCE(n.recipient_email, n.recipient_phone) AS recipient,
    NULL::text                              AS recipient_name,
    n.subject,
    n.body,
    n.type                                  AS template_key,
    n.shipment_id,
    NULL::uuid                              AS client_id,
    NULL::uuid                              AS driver_id,
    NULL::uuid                              AS subcontractor_id,
    n.invoice_id,
    n.status::text                          AS status,
    n.error_message,
    COALESCE(n.sent_at, n.created_at)       AS occurred_at,
    NULL::uuid                              AS actor_user_id
  FROM public.notifications n;

GRANT SELECT ON public.v_inbox_unified TO authenticated;

COMMIT;
