-- ============================================
-- Agregar columnas de ubicación a pre_operational_checklists
-- ============================================
-- Permite guardar lat/long cuando el usuario autoriza ubicación.
-- Ejecutar en Supabase SQL Editor si el checklist falla con
-- "Could not find the 'location_latitude' column".
-- ============================================

ALTER TABLE pre_operational_checklists
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8) NULL;

ALTER TABLE pre_operational_checklists
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8) NULL;

COMMENT ON COLUMN pre_operational_checklists.location_latitude IS 'Latitud GPS al momento del checklist (opcional)';
COMMENT ON COLUMN pre_operational_checklists.location_longitude IS 'Longitud GPS al momento del checklist (opcional)';
