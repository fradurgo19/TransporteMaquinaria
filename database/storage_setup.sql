-- ============================================
-- CONFIGURACIÓN DE SUPABASE STORAGE
-- ============================================

-- NOTA: Los buckets se crean desde Supabase Dashboard → Storage
-- Crear 3 buckets:
-- 1. fuel-receipts (para fotos de recibos de combustible)
-- 2. operation-photos (para fotos de operaciones)
-- 3. checklist-photos (para fotos de checklist)

-- Políticas RLS para fuel-receipts bucket
-- Usuarios autenticados pueden subir fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('operation-photos', 'operation-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-documents', 'equipment-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas para fuel-receipts
CREATE POLICY "Users can upload fuel receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fuel-receipts');

CREATE POLICY "Users can view fuel receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fuel-receipts');

CREATE POLICY "Users can update fuel receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fuel-receipts');

CREATE POLICY "Admins can delete fuel receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fuel-receipts' AND
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_logistics'))
);

-- Políticas para operation-photos
CREATE POLICY "Users can upload operation photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'operation-photos');

CREATE POLICY "Users can view operation photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'operation-photos');

CREATE POLICY "Users can update operation photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'operation-photos');

CREATE POLICY "Admins can delete operation photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'operation-photos' AND
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_logistics'))
);

-- Políticas para checklist-photos
CREATE POLICY "Users can upload checklist photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklist-photos');

CREATE POLICY "Users can view checklist photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'checklist-photos');

CREATE POLICY "Users can update checklist photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'checklist-photos');

CREATE POLICY "Admins can delete checklist photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checklist-photos' AND
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_logistics'))
);

-- Políticas para equipment-documents
CREATE POLICY "Users can upload equipment documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'equipment-documents');

CREATE POLICY "Users can view equipment documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'equipment-documents');

CREATE POLICY "Admins can update equipment documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'equipment-documents' AND
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_logistics'))
);

CREATE POLICY "Admins can delete equipment documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'equipment-documents' AND
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_logistics'))
);

-- Agregar columnas para almacenar URLs de fotos
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS photo_urls TEXT[]; -- Array de URLs
ALTER TABLE pre_operational_checklists ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Agregar columnas para documentos de equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS technical_inspection_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS soat_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS insurance_policy_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS driver_license_url TEXT;

COMMENT ON COLUMN fuel_logs.receipt_photo_url IS 'URL de la foto del recibo en Supabase Storage';
COMMENT ON COLUMN operations.photo_urls IS 'URLs de fotos de la operación en Supabase Storage';
COMMENT ON COLUMN pre_operational_checklists.photo_url IS 'URL de la foto del checklist en Supabase Storage';
COMMENT ON COLUMN equipment.technical_inspection_url IS 'URL del documento de revisión técnica';
COMMENT ON COLUMN equipment.soat_url IS 'URL del documento SOAT';
COMMENT ON COLUMN equipment.insurance_policy_url IS 'URL del documento de póliza';
COMMENT ON COLUMN equipment.driver_license_url IS 'URL del documento de licencia';

