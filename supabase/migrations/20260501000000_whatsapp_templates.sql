-- ============================================================
-- M2: WhatsApp intégré (manual deeplink workflow)
--
-- MASLAK runs operationally on WhatsApp (dispatcher↔driver, manager↔
-- client manual). Industrial clients use SAP/Oracle and are NOT auto-
-- notified. This module ships:
--   1. whatsapp_templates per tenant (parameterized message bodies
--      with {{var}} placeholders for shipment/driver/client context).
--   2. whatsapp_send_log audit trail (we record intent — actual
--      delivery happens via wa.me deeplink in the user's WhatsApp
--      client; we cannot confirm receipt).
--   3. Seed default templates for every existing tenant covering the
--      most frequent ops moments (mission assigned, ETA, delivered,
--      late, subcontractor briefing, payment reminder).
--   4. Audit log entity_type extended with 'whatsapp_template' and
--      'whatsapp_send'.
--
-- This is OUTBOUND-ONLY and OPT-IN per send. It does NOT replace the
-- abstract NotificationProvider stub in src/lib/notifications/ — that
-- is gated behind NEXT_PUBLIC_WHATSAPP_ENABLED for any future Cloud
-- API integration.
-- ============================================================

BEGIN;

-- ============================================================
-- whatsapp_templates
-- ============================================================
CREATE TABLE public.whatsapp_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  key         text NOT NULL,
  name        text NOT NULL,
  audience    text NOT NULL CHECK (audience IN ('driver','client','subcontractor','internal')),
  body        text NOT NULL,

  is_active   boolean NOT NULL DEFAULT true,

  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,

  CONSTRAINT whatsapp_templates_company_key_unique UNIQUE (company_id, key)
);

CREATE INDEX whatsapp_templates_company_active_idx
  ON public.whatsapp_templates (company_id, audience)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER whatsapp_templates_set_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_super_admin" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "whatsapp_templates_back_office_read" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "whatsapp_templates_back_office_write" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- whatsapp_send_log
-- ============================================================
CREATE TABLE public.whatsapp_send_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  template_id         uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_key        text,
  audience            text NOT NULL CHECK (audience IN ('driver','client','subcontractor','internal')),

  recipient_phone     text NOT NULL,
  recipient_name      text,
  body_rendered       text NOT NULL,

  shipment_id         uuid REFERENCES public.shipments(id)       ON DELETE SET NULL,
  client_id           uuid REFERENCES public.clients(id)         ON DELETE SET NULL,
  driver_id           uuid REFERENCES public.drivers(id)         ON DELETE SET NULL,
  subcontractor_id    uuid REFERENCES public.subcontractors(id)  ON DELETE SET NULL,

  sent_by_user_id     uuid REFERENCES public.users(id)           ON DELETE SET NULL,
  sent_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_send_log_company_idx
  ON public.whatsapp_send_log (company_id, sent_at DESC);
CREATE INDEX whatsapp_send_log_shipment_idx
  ON public.whatsapp_send_log (shipment_id) WHERE shipment_id IS NOT NULL;

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_send_log_super_admin" ON public.whatsapp_send_log
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "whatsapp_send_log_back_office_read" ON public.whatsapp_send_log
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "whatsapp_send_log_back_office_insert" ON public.whatsapp_send_log
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher')
  );

-- ============================================================
-- Seed default templates per tenant.
-- Idempotent: skip when (company_id, key) already exists.
-- Bodies use Handlebars-style {{var}} placeholders rendered server-side.
-- ============================================================
INSERT INTO public.whatsapp_templates (company_id, key, name, audience, body)
SELECT c.id, t.key, t.name, t.audience, t.body
FROM public.companies c
CROSS JOIN (VALUES
  (
    'mission_assigned',
    'Mission assignée (chauffeur)',
    'driver',
    E'Salam {{driver_first_name}}, nouvelle mission *{{shipment_ref}}*\n\nEnlèvement : {{pickup_city}}\nLivraison : {{delivery_city}}\nRDV livraison : {{delivery_time}}\nClient : {{client_name}}\n\nBonne route 👍'
  ),
  (
    'pickup_confirmed',
    'Enlèvement confirmé (client)',
    'client',
    E'Bonjour {{client_contact}},\n\nLa mission *{{shipment_ref}}* a bien été enlevée à {{pickup_time}} ({{pickup_city}}).\nLivraison prévue à {{delivery_city}} le {{delivery_time}}.\n\nCordialement,\n{{company_name}}'
  ),
  (
    'in_transit_eta',
    'En route — ETA (client)',
    'client',
    E'Bonjour {{client_contact}},\n\nMission *{{shipment_ref}}* en route vers {{delivery_city}}.\nETA : {{delivery_time}}\nChauffeur : {{driver_name}} ({{vehicle_plate}})\n\n{{company_name}}'
  ),
  (
    'delivered_confirmation',
    'Livraison confirmée (client)',
    'client',
    E'Bonjour {{client_contact}},\n\nLivraison *{{shipment_ref}}* effectuée à {{delivery_time}} à {{delivery_city}}.\nPOD disponible sur demande.\n\nMerci de votre confiance,\n{{company_name}}'
  ),
  (
    'late_alert',
    'Alerte retard JIT (client)',
    'client',
    E'Bonjour {{client_contact}},\n\nNous tenons à vous informer d''un retard sur la mission *{{shipment_ref}}* (livraison {{delivery_city}}).\nNouveau délai estimé : {{delivery_time}}\n\nDésolés pour la gêne occasionnée.\n{{company_name}}'
  ),
  (
    'subcontractor_briefing',
    'Briefing sous-traitant',
    'subcontractor',
    E'Salam {{subcontractor_contact}},\n\nMission confiée : *{{mission_order_ref}}*\n{{pickup_city}} → {{delivery_city}}\nRDV enlèvement : {{pickup_time}}\nCoût convenu : {{cost}}\n\nMerci de confirmer la réception.\n{{company_name}}'
  ),
  (
    'payment_reminder',
    'Relance paiement (client)',
    'client',
    E'Bonjour {{client_contact}},\n\nRappel concernant la facture *{{invoice_number}}* d''un montant de {{invoice_amount}}, échue depuis le {{invoice_due_date}}.\nMerci de bien vouloir régulariser dès que possible.\n\nCordialement,\n{{company_name}}'
  )
) AS t(key, name, audience, body)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates wt
  WHERE wt.company_id = c.id AND wt.key = t.key
);

-- ============================================================
-- Audit log: extend entity_type with whatsapp_template + whatsapp_send
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
    'whatsapp_send'
  ));

COMMIT;
