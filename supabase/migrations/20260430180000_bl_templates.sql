-- ============================================================
-- N-1: bl_templates + bl_template_fields
--
-- Per-client Bordereau de Livraison templates. Each automotive client
-- (TESCA, SAGE, ERT, COBA, DUTCHER) demands its own custom fields on
-- the BL: PO Number, Part Number, lot, dock, RDV time, EDI/DUNS,
-- container #, etc. The shipment form will read the active template
-- for the chosen client and render dynamic fields; this ticket only
-- ships the template engine + default field set.
--
-- Shipment integration is a separate ticket (will store captured
-- values in shipments.bl_data JSONB keyed by field_key).
-- ============================================================

BEGIN;

-- ============================================================
-- bl_templates
-- One row per (client, template name). Optional multiple templates
-- per client; exactly one is_default = true at any time per client.
-- ============================================================
CREATE TABLE public.bl_templates (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id           uuid          NOT NULL REFERENCES public.clients(id)   ON DELETE RESTRICT,

  name                text          NOT NULL,                  -- e.g. "BL standard TESCA"
  is_default          boolean       NOT NULL DEFAULT false,
  notes               text,

  created_by_user_id  uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_bl_templates_company_id ON public.bl_templates(company_id);
CREATE INDEX idx_bl_templates_client_id  ON public.bl_templates(client_id);

-- At most one default per client (when not soft-deleted).
CREATE UNIQUE INDEX uniq_bl_templates_default_per_client
  ON public.bl_templates(client_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE TRIGGER trg_bl_templates_updated_at
  BEFORE UPDATE ON public.bl_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bl_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blt_super_admin" ON public.bl_templates
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "blt_back_office_all" ON public.bl_templates
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

-- Drivers see templates of clients on their assigned shipments at runtime
-- via JOIN; we don't expose a blanket SELECT here. Client portal users
-- read their own template (read-only) so they can preview their BL form.
CREATE POLICY "blt_client_self_select" ON public.bl_templates
  FOR SELECT TO authenticated
  USING (
    client_id = public.current_client_id()
    AND public.current_user_role() = 'client'
  );

-- ============================================================
-- bl_template_fields
-- Ordered list of fields rendered on the dispatcher's shipment form
-- when this template is active. field_key is the JSON property name
-- written to shipments.bl_data; label is what the user sees.
-- ============================================================
CREATE TABLE public.bl_template_fields (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid          NOT NULL REFERENCES public.bl_templates(id) ON DELETE CASCADE,
  company_id      uuid          NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  field_key       text          NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{0,49}$'),
  label           text          NOT NULL,
  field_type      text          NOT NULL CHECK (field_type IN (
                                  'text', 'number', 'date', 'time', 'textarea', 'select'
                                )),

  is_required     boolean       NOT NULL DEFAULT false,
  is_visible      boolean       NOT NULL DEFAULT true,
  placeholder     text,
  default_value   text,
  help_text       text,
  -- For field_type = 'select' only. Stored as ["opt1","opt2"].
  select_options  jsonb         NOT NULL DEFAULT '[]'::jsonb,

  sort_order      integer       NOT NULL DEFAULT 0,

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_bl_fields_template ON public.bl_template_fields(template_id, sort_order);
CREATE INDEX idx_bl_fields_company  ON public.bl_template_fields(company_id);

-- field_key must be unique within a template (so the JSONB writer never
-- collides). DB-level guarantee, not just app code.
CREATE UNIQUE INDEX uniq_bl_fields_key_per_template
  ON public.bl_template_fields(template_id, field_key);

CREATE TRIGGER trg_bl_fields_updated_at
  BEFORE UPDATE ON public.bl_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bl_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blf_super_admin" ON public.bl_template_fields
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "blf_back_office_all" ON public.bl_template_fields
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "blf_client_self_select" ON public.bl_template_fields
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND template_id IN (
      SELECT id FROM public.bl_templates
      WHERE client_id = public.current_client_id() AND deleted_at IS NULL
    )
  );

-- ============================================================
-- SEED: create one default BL template per existing client with the
-- standard automotive field set (per the user clarifications). Skips
-- clients that already have a template, so the migration is idempotent.
-- ============================================================
DO $$
DECLARE
  v_client RECORD;
  v_template_id uuid;
  v_field RECORD;
BEGIN
  FOR v_client IN
    SELECT id, company_id, business_name
    FROM public.clients
    WHERE deleted_at IS NULL
  LOOP
    -- Skip if any template already exists for this client
    IF EXISTS (
      SELECT 1 FROM public.bl_templates
      WHERE client_id = v_client.id AND deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.bl_templates (
      company_id, client_id, name, is_default, notes
    )
    VALUES (
      v_client.company_id,
      v_client.id,
      'BL standard ' || v_client.business_name,
      true,
      'Modèle généré automatiquement avec les champs automobiles par défaut. À ajuster selon les exigences du client.'
    )
    RETURNING id INTO v_template_id;

    FOR v_field IN
      SELECT * FROM (VALUES
        ('po_number',     'N° de commande (PO)',  'text',     true,  10, 'Référence commande client', NULL::text),
        ('part_number',   'Référence article',    'text',     true,  20, 'Part Number',               NULL::text),
        ('quantity',      'Quantité',             'number',   true,  30, 'Quantité par référence',    NULL::text),
        ('lot_number',    'N° de lot',            'text',     false, 40, 'Lot de production',         NULL::text),
        ('expiry_date',   'Date de péremption',   'date',     false, 50, NULL,                        NULL::text),
        ('dock_number',   'N° de quai',           'text',     false, 60, 'Quai de déchargement',      NULL::text),
        ('rdv_time',      'Créneau RDV',          'time',     false, 70, NULL,                        NULL::text),
        ('edi_duns',      'Code EDI / DUNS',      'text',     false, 80, NULL,                        NULL::text),
        ('container_number','N° de conteneur',    'text',     false, 90, 'À l''export uniquement',    NULL::text)
      ) AS f(field_key, label, field_type, is_required, sort_order, placeholder, help_text)
    LOOP
      INSERT INTO public.bl_template_fields (
        template_id, company_id, field_key, label, field_type,
        is_required, is_visible, placeholder, help_text, sort_order
      )
      VALUES (
        v_template_id,
        v_client.company_id,
        v_field.field_key,
        v_field.label,
        v_field.field_type,
        v_field.is_required,
        true,
        v_field.placeholder,
        v_field.help_text,
        v_field.sort_order
      );
    END LOOP;
  END LOOP;
END $$;

COMMIT;
