-- ============================================
-- SISTEMA DE NOTIFICACIONES POR EMAIL
-- ============================================

-- Tabla para registrar notificaciones enviadas (evitar duplicados)
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'tecno', 'soat', 'poliza', 'licencia'
  expiration_date DATE NOT NULL,
  notification_type VARCHAR(20) NOT NULL, -- '10_days' o '5_days'
  sent_to VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  email_subject TEXT,
  email_body TEXT,
  status VARCHAR(20) DEFAULT 'sent' -- 'sent', 'failed', 'pending'
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_equipment ON email_notifications(equipment_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at ON email_notifications(sent_at);

-- Vista para documentos próximos a vencer
DROP VIEW IF EXISTS documents_expiring_soon;

CREATE VIEW documents_expiring_soon AS
SELECT 
  e.id as equipment_id,
  e.license_plate::TEXT as license_plate,
  e.driver_name::TEXT as driver_name,
  e.brand::TEXT as brand,
  e.site_location::TEXT as site_location,
  e.department::TEXT as department,
  'tecno'::TEXT as document_type,
  e.technical_inspection_expiration as expiration_date,
  e.technical_inspection_expiration - CURRENT_DATE as days_until_expiration
FROM equipment e
WHERE e.status = 'active'
  AND e.technical_inspection_expiration - CURRENT_DATE IN (10, 5)

UNION ALL

SELECT 
  e.id,
  e.license_plate::TEXT,
  e.driver_name::TEXT,
  e.brand::TEXT,
  e.site_location::TEXT,
  e.department::TEXT,
  'soat'::TEXT,
  e.soat_expiration,
  e.soat_expiration - CURRENT_DATE
FROM equipment e
WHERE e.status = 'active'
  AND e.soat_expiration - CURRENT_DATE IN (10, 5)

UNION ALL

SELECT 
  e.id,
  e.license_plate::TEXT,
  e.driver_name::TEXT,
  e.brand::TEXT,
  e.site_location::TEXT,
  e.department::TEXT,
  'poliza'::TEXT,
  e.insurance_policy_expiration,
  e.insurance_policy_expiration - CURRENT_DATE
FROM equipment e
WHERE e.status = 'active'
  AND e.insurance_policy_expiration - CURRENT_DATE IN (10, 5)

UNION ALL

SELECT 
  e.id,
  e.license_plate::TEXT,
  e.driver_name::TEXT,
  e.brand::TEXT,
  e.site_location::TEXT,
  e.department::TEXT,
  'licencia'::TEXT,
  e.driver_license_expiration,
  e.driver_license_expiration - CURRENT_DATE
FROM equipment e
WHERE e.status = 'active'
  AND e.driver_license_expiration - CURRENT_DATE IN (10, 5);

-- Función para obtener documentos que necesitan notificación
CREATE OR REPLACE FUNCTION get_pending_notifications()
RETURNS TABLE (
  equipment_id UUID,
  license_plate TEXT,
  driver_name TEXT,
  brand TEXT,
  site_location TEXT,
  department TEXT,
  document_type TEXT,
  expiration_date DATE,
  days_until_expiration INTEGER,
  notification_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.equipment_id,
    d.license_plate,
    d.driver_name,
    d.brand,
    d.site_location,
    d.department,
    d.document_type,
    d.expiration_date,
    d.days_until_expiration,
    CASE 
      WHEN d.days_until_expiration = 10 THEN '10_days'
      WHEN d.days_until_expiration = 5 THEN '5_days'
    END::TEXT as notification_type
  FROM documents_expiring_soon d
  WHERE NOT EXISTS (
    -- No enviar si ya se envió una notificación del mismo tipo hoy
    SELECT 1 FROM email_notifications en
    WHERE en.equipment_id = d.equipment_id
      AND en.document_type = d.document_type
      AND en.notification_type = CASE 
          WHEN d.days_until_expiration = 10 THEN '10_days'
          WHEN d.days_until_expiration = 5 THEN '5_days'
        END
      AND DATE(en.sent_at) = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all notifications"
ON email_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "System can insert notifications"
ON email_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON TABLE email_notifications IS 'Registro de notificaciones por email enviadas';
COMMENT ON VIEW documents_expiring_soon IS 'Documentos que vencen en 10 o 5 días';

