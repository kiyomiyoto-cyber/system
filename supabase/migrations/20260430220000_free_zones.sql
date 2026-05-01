-- ============================================================
-- N-6: Zones franches & douane
--
-- MASLAK opère sur 4 zones franches récurrentes (Tanger Med,
-- Tanger Free Zone, Atlantic Free Zone Kénitra, Mid Atlantic
-- Logistics) avec des procédures douanières standardisées
-- (DUM, BAE, T1, EUR1, CMR). Le dispatcher doit pouvoir :
--   1. Marquer une expédition comme franchissant une zone franche
--      en chargement et/ou en livraison.
--   2. Voir la checklist documentaire requise pour la mission.
--   3. Téléverser chaque pièce dans un bucket privé, par mission,
--      avec un type identifié (DUM, BAE, etc.).
--   4. Suivre le pourcentage de complétion (toutes pièces requises
--      téléversées).
--
-- Ce fichier livre :
--   - free_zones (référentiel multi-tenant SaaS-ready)
--   - customs_document_types (référentiel + flag obligatoire par défaut)
--   - free_zone_required_documents (matrice zone × type)
--   - shipment_customs_documents (pièces téléversées par mission)
--   - shipments.pickup_free_zone_id / delivery_free_zone_id
--   - bucket Storage privé `customs-documents`
--   - seed des 4 zones MASLAK + 5 types de document standards
-- ============================================================

BEGIN;

-- ============================================================
-- 1. customs_document_types — référentiel global (par tenant)
-- ============================================================
CREATE TABLE public.customs_document_types (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  code                     text          NOT NULL,                                 -- DUM, BAE, T1, EUR1, CMR
  name                     text          NOT NULL,                                 -- Déclaration Unique de Marchandise…
  description              text,

  applicable_to            text          NOT NULL DEFAULT 'both'
                                         CHECK (applicable_to IN ('import', 'export', 'both')),
  required_by_default      boolean       NOT NULL DEFAULT true,                    -- true = doc presque toujours obligatoire
  sort_order               integer       NOT NULL DEFAULT 0,

  is_active                boolean       NOT NULL DEFAULT true,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz,

  CONSTRAINT cdt_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX idx_cdt_company_active ON public.customs_document_types(company_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_cdt_updated_at
  BEFORE UPDATE ON public.customs_document_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customs_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdt_super_admin" ON public.customs_document_types
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "cdt_back_office_select" ON public.customs_document_types
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "cdt_back_office_write" ON public.customs_document_types
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
-- 2. free_zones — référentiel des zones franches utilisées par
-- l'entreprise. Pré-rempli pour le tenant demo via seed bloc bas.
-- ============================================================
CREATE TABLE public.free_zones (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  code                     text          NOT NULL,                                 -- TMZ, TFZ, AFZ, MAL
  name                     text          NOT NULL,
  city                     text          NOT NULL,
  country                  char(2)       NOT NULL DEFAULT 'MA',

  customs_office_code      text,                                                   -- code bureau de douane (ex: 305 Tanger Med)
  notes                    text,

  is_active                boolean       NOT NULL DEFAULT true,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz,

  CONSTRAINT fz_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX idx_fz_company_active ON public.free_zones(company_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_fz_updated_at
  BEFORE UPDATE ON public.free_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.free_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fz_super_admin" ON public.free_zones
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "fz_back_office_select" ON public.free_zones
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "fz_back_office_write" ON public.free_zones
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
-- 3. free_zone_required_documents — matrice zone × type doc.
-- Permet de redéfinir la checklist pour une zone (ex: Tanger Med
-- exige T1 systématiquement, AFZ Kénitra non).
-- ============================================================
CREATE TABLE public.free_zone_required_documents (
  free_zone_id             uuid          NOT NULL REFERENCES public.free_zones(id) ON DELETE CASCADE,
  document_type_id         uuid          NOT NULL REFERENCES public.customs_document_types(id) ON DELETE CASCADE,
  company_id               uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_required              boolean       NOT NULL DEFAULT true,
  notes                    text,
  created_at               timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (free_zone_id, document_type_id)
);

CREATE INDEX idx_fzrd_company  ON public.free_zone_required_documents(company_id);
CREATE INDEX idx_fzrd_zone     ON public.free_zone_required_documents(free_zone_id);
CREATE INDEX idx_fzrd_doctype  ON public.free_zone_required_documents(document_type_id);

ALTER TABLE public.free_zone_required_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fzrd_super_admin" ON public.free_zone_required_documents
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "fzrd_back_office_select" ON public.free_zone_required_documents
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "fzrd_back_office_write" ON public.free_zone_required_documents
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
-- 4. shipments — back-link vers les zones franches
-- ============================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pickup_free_zone_id    uuid REFERENCES public.free_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_free_zone_id  uuid REFERENCES public.free_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_pickup_fz
  ON public.shipments(pickup_free_zone_id) WHERE pickup_free_zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_fz
  ON public.shipments(delivery_free_zone_id) WHERE delivery_free_zone_id IS NOT NULL;

-- ============================================================
-- 5. shipment_customs_documents — pièces téléversées par mission
-- ============================================================
CREATE TABLE public.shipment_customs_documents (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shipment_id              uuid          NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  document_type_id         uuid          NOT NULL REFERENCES public.customs_document_types(id) ON DELETE RESTRICT,

  document_number          text,                                                   -- N° DUM, N° T1, etc.
  document_date            date,
  storage_path             text          NOT NULL,                                 -- chemin dans bucket customs-documents
  file_name                text          NOT NULL,
  mime_type                text          NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size_bytes          integer       NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10 * 1024 * 1024),

  notes                    text,

  uploaded_by_user_id      uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE INDEX idx_scd_shipment       ON public.shipment_customs_documents(shipment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_scd_company_recent ON public.shipment_customs_documents(company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_scd_doctype        ON public.shipment_customs_documents(document_type_id);

CREATE TRIGGER trg_scd_updated_at
  BEFORE UPDATE ON public.shipment_customs_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defense in depth: empêcher un mix entre tenants
CREATE OR REPLACE FUNCTION public.enforce_scd_company()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_ship_co  uuid;
  v_type_co  uuid;
BEGIN
  SELECT company_id INTO v_ship_co  FROM public.shipments               WHERE id = NEW.shipment_id;
  SELECT company_id INTO v_type_co  FROM public.customs_document_types  WHERE id = NEW.document_type_id;
  IF v_ship_co IS DISTINCT FROM NEW.company_id OR v_type_co IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cross-company customs document is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scd_enforce_company
  BEFORE INSERT OR UPDATE OF shipment_id, document_type_id, company_id ON public.shipment_customs_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scd_company();

ALTER TABLE public.shipment_customs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scd_super_admin" ON public.shipment_customs_documents
  FOR ALL TO authenticated
  USING  (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "scd_back_office_select" ON public.shipment_customs_documents
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role('company_admin', 'dispatcher', 'comptable')
  );

CREATE POLICY "scd_back_office_write" ON public.shipment_customs_documents
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
-- 6. Storage bucket privé `customs-documents`
-- Layout: {company_id}/{shipment_id}/{document_type_code}_{timestamp}.{ext}
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('customs-documents', 'customs-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "customs_docs_super_admin" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'customs-documents' AND public.current_user_role() = 'super_admin')
  WITH CHECK (bucket_id = 'customs-documents' AND public.current_user_role() = 'super_admin');

CREATE POLICY "customs_docs_back_office_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'customs-documents'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'customs-documents'
    AND public.has_any_role('company_admin', 'dispatcher')
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "customs_docs_comptable_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'customs-documents'
    AND public.current_user_role() = 'comptable'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ============================================================
-- 7. Vue v_shipment_customs_compliance
-- Pour chaque shipment qui touche au moins une zone franche,
-- compte les documents requis vs téléversés. Sert à la pastille
-- "compliance" du dashboard et de la liste missions.
-- ============================================================
CREATE OR REPLACE VIEW public.v_shipment_customs_compliance AS
WITH zones AS (
  SELECT s.id              AS shipment_id,
         s.company_id,
         s.pickup_free_zone_id,
         s.delivery_free_zone_id
  FROM public.shipments s
  WHERE (s.pickup_free_zone_id IS NOT NULL OR s.delivery_free_zone_id IS NOT NULL)
    AND s.deleted_at IS NULL
),
required AS (
  SELECT DISTINCT z.shipment_id, z.company_id, fzrd.document_type_id
  FROM zones z
  JOIN public.free_zone_required_documents fzrd
    ON fzrd.free_zone_id IN (z.pickup_free_zone_id, z.delivery_free_zone_id)
   AND fzrd.is_required = true
),
uploaded AS (
  SELECT scd.shipment_id, scd.document_type_id
  FROM public.shipment_customs_documents scd
  WHERE scd.deleted_at IS NULL
)
SELECT
  z.shipment_id,
  z.company_id,
  COUNT(DISTINCT r.document_type_id)::integer  AS required_count,
  COUNT(DISTINCT CASE
    WHEN u.document_type_id IS NOT NULL THEN r.document_type_id
  END)::integer                                AS uploaded_count,
  CASE
    WHEN COUNT(DISTINCT r.document_type_id) = 0 THEN 'no_requirement'::text
    WHEN COUNT(DISTINCT CASE WHEN u.document_type_id IS NOT NULL THEN r.document_type_id END)
       = COUNT(DISTINCT r.document_type_id) THEN 'complete'::text
    WHEN COUNT(DISTINCT CASE WHEN u.document_type_id IS NOT NULL THEN r.document_type_id END) = 0
         THEN 'missing'::text
    ELSE 'partial'::text
  END                                          AS compliance_status
FROM zones z
LEFT JOIN required r ON r.shipment_id = z.shipment_id
LEFT JOIN uploaded u ON u.shipment_id = z.shipment_id AND u.document_type_id = r.document_type_id
GROUP BY z.shipment_id, z.company_id;

GRANT SELECT ON public.v_shipment_customs_compliance TO authenticated, service_role;

-- ============================================================
-- 8. Seed — 5 types doc + 4 zones franches + matrice par défaut
-- pour le tenant demo (et tout futur tenant via DO bloc générique).
-- Idempotent : ON CONFLICT DO NOTHING.
-- ============================================================
DO $$
DECLARE
  v_company_id  uuid;
  v_dum_id      uuid;
  v_bae_id      uuid;
  v_t1_id       uuid;
  v_eur1_id     uuid;
  v_cmr_id      uuid;
  v_tmz_id      uuid;
  v_tfz_id      uuid;
  v_afz_id      uuid;
  v_mal_id      uuid;
BEGIN
  FOR v_company_id IN SELECT id FROM public.companies WHERE deleted_at IS NULL LOOP
    -- Document types ---------------------------------------------------
    INSERT INTO public.customs_document_types (id, company_id, code, name, description, applicable_to, required_by_default, sort_order)
    VALUES
      (gen_random_uuid(), v_company_id, 'DUM',  'Déclaration Unique de Marchandise',          'Document douanier marocain principal pour import/export',  'both',   true,  10),
      (gen_random_uuid(), v_company_id, 'BAE',  'Bon À Enlever',                              'Autorisation d''enlèvement délivrée par la douane',         'both',   true,  20),
      (gen_random_uuid(), v_company_id, 'T1',   'Document de transit communautaire T1',       'Transit douanier sous suivi',                                'both',   false, 30),
      (gen_random_uuid(), v_company_id, 'EUR1', 'Certificat de circulation EUR.1',            'Certificat d''origine préférentielle UE / Maroc',           'export', false, 40),
      (gen_random_uuid(), v_company_id, 'CMR',  'Lettre de voiture CMR',                      'Contrat de transport international par route',               'both',   true,  50)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Resolve resulting IDs (whether just inserted or already there)
    SELECT id INTO v_dum_id  FROM public.customs_document_types WHERE company_id = v_company_id AND code = 'DUM';
    SELECT id INTO v_bae_id  FROM public.customs_document_types WHERE company_id = v_company_id AND code = 'BAE';
    SELECT id INTO v_t1_id   FROM public.customs_document_types WHERE company_id = v_company_id AND code = 'T1';
    SELECT id INTO v_eur1_id FROM public.customs_document_types WHERE company_id = v_company_id AND code = 'EUR1';
    SELECT id INTO v_cmr_id  FROM public.customs_document_types WHERE company_id = v_company_id AND code = 'CMR';

    -- Free zones -------------------------------------------------------
    INSERT INTO public.free_zones (id, company_id, code, name, city, country, customs_office_code, notes)
    VALUES
      (gen_random_uuid(), v_company_id, 'TMZ', 'Tanger Med Zone Free Trade',  'Tanger',  'MA', '305',  'Zone du port Tanger Med, procédures complètes import/export'),
      (gen_random_uuid(), v_company_id, 'TFZ', 'Tanger Free Zone',            'Tanger',  'MA', '301',  'Ancienne zone franche industrielle de Tanger'),
      (gen_random_uuid(), v_company_id, 'AFZ', 'Atlantic Free Zone Kénitra',  'Kénitra', 'MA', '210',  'Zone franche automobile Kénitra (Renault, Stellantis…)'),
      (gen_random_uuid(), v_company_id, 'MAL', 'Mid Atlantic Logistics',      'Tiflet',  'MA', NULL,   'Zone logistique Tiflet / Khémisset')
    ON CONFLICT (company_id, code) DO NOTHING;

    SELECT id INTO v_tmz_id FROM public.free_zones WHERE company_id = v_company_id AND code = 'TMZ';
    SELECT id INTO v_tfz_id FROM public.free_zones WHERE company_id = v_company_id AND code = 'TFZ';
    SELECT id INTO v_afz_id FROM public.free_zones WHERE company_id = v_company_id AND code = 'AFZ';
    SELECT id INTO v_mal_id FROM public.free_zones WHERE company_id = v_company_id AND code = 'MAL';

    -- Required documents matrix ---------------------------------------
    -- Tanger Med: full export — DUM + BAE + T1 + EUR1 + CMR
    -- TFZ:        DUM + BAE + CMR
    -- AFZ:        DUM + BAE + CMR (auto JIT)
    -- MAL:        DUM + CMR (zone logistique simple)
    INSERT INTO public.free_zone_required_documents (free_zone_id, document_type_id, company_id, is_required) VALUES
      (v_tmz_id, v_dum_id,  v_company_id, true),
      (v_tmz_id, v_bae_id,  v_company_id, true),
      (v_tmz_id, v_t1_id,   v_company_id, true),
      (v_tmz_id, v_eur1_id, v_company_id, true),
      (v_tmz_id, v_cmr_id,  v_company_id, true),
      (v_tfz_id, v_dum_id,  v_company_id, true),
      (v_tfz_id, v_bae_id,  v_company_id, true),
      (v_tfz_id, v_cmr_id,  v_company_id, true),
      (v_afz_id, v_dum_id,  v_company_id, true),
      (v_afz_id, v_bae_id,  v_company_id, true),
      (v_afz_id, v_cmr_id,  v_company_id, true),
      (v_mal_id, v_dum_id,  v_company_id, true),
      (v_mal_id, v_cmr_id,  v_company_id, true)
    ON CONFLICT (free_zone_id, document_type_id) DO NOTHING;
  END LOOP;
END;
$$;

COMMIT;
