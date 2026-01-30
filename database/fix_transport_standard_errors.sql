-- ============================================
-- Corrección de errores en módulos de transporte estándar
-- Ejecutar en Supabase SQL Editor si aparecen:
-- - fuel_logs 400 (columnas department, receipt_photo_url)
-- - operations driver_name NOT NULL
-- - pre_operational_checklists sin columna department
-- - transport_requests "record new has no field created_by" (trigger audit)
-- ============================================

-- 1. fuel_logs: asegurar columnas department y receipt_photo_url
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;
COMMENT ON COLUMN fuel_logs.department IS 'Departamento: transport o logistics';
COMMENT ON COLUMN fuel_logs.receipt_photo_url IS 'URL de la foto del recibo en Storage';

-- 2. pre_operational_checklists: asegurar columna department
ALTER TABLE pre_operational_checklists ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
CREATE INDEX IF NOT EXISTS idx_checklists_department ON pre_operational_checklists(department);

-- 3. transport_requests: trigger de auditoría usa created_by pero la tabla tiene requested_by.
--    Actualizar la función audit_changes para usar requested_by en transport_requests.
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_by UUID;
BEGIN
  IF TG_TABLE_NAME = 'transport_requests' THEN
    v_changed_by := (NEW).requested_by;
  ELSE
    v_changed_by := (NEW).created_by;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), v_changed_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), v_changed_by);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Actualizar registros existentes sin department (opcional)
UPDATE fuel_logs SET department = 'transport' WHERE department IS NULL;
UPDATE pre_operational_checklists SET department = 'transport' WHERE department IS NULL;
