-- ============================================
-- SISTEMA DE NOTIFICACIONES POR EMAIL PARA OPERACIONES
-- ============================================

-- 1. Agregar campo equipment_serial a operations
ALTER TABLE operations
ADD COLUMN IF NOT EXISTS equipment_serial VARCHAR(100);

COMMENT ON COLUMN operations.equipment_serial IS 'Serie del equipo a transportar (ingresado por el usuario)';

-- 2. Agregar campo notification_sent para rastrear si se envió notificación
ALTER TABLE operations
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

ALTER TABLE operations
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN operations.notification_sent IS 'Indica si se envió notificación por email';
COMMENT ON COLUMN operations.notification_sent_at IS 'Fecha y hora en que se envió la notificación';

-- 3. Tabla para registrar notificaciones de operaciones enviadas
CREATE TABLE IF NOT EXISTS operation_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  sent_to VARCHAR(255) NOT NULL, -- Email del destinatario
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  email_subject TEXT,
  email_body TEXT,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_operation_notifications_operation ON operation_notifications(operation_id);
CREATE INDEX IF NOT EXISTS idx_operation_notifications_sent_at ON operation_notifications(sent_at);

-- 4. Función para obtener destinatarios de notificaciones de operaciones
-- Incluye: conductor, administradores, y usuarios relacionados
CREATE OR REPLACE FUNCTION get_operation_notification_recipients(operation_id_param UUID)
RETURNS TABLE (
  email VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  -- Obtener email del conductor (desde la operación)
  SELECT DISTINCT
    u.email,
    COALESCE(u.full_name, u.username) as full_name,
    u.role
  FROM operations o
  JOIN users u ON u.id = o.created_by
  WHERE o.id = operation_id_param
  
  UNION
  
  -- Obtener todos los administradores
  SELECT DISTINCT
    u.email,
    COALESCE(u.full_name, u.username) as full_name,
    u.role
  FROM users u
  WHERE u.role IN ('admin', 'admin_logistics')
    AND u.is_active = true
  
  UNION
  
  -- Obtener usuario que creó la operación (si es diferente del conductor)
  SELECT DISTINCT
    u.email,
    COALESCE(u.full_name, u.username) as full_name,
    u.role
  FROM operations o
  JOIN users u ON u.id = o.created_by
  WHERE o.id = operation_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para marcar operación como notificada
CREATE OR REPLACE FUNCTION mark_operation_notified(operation_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE operations
  SET 
    notification_sent = true,
    notification_sent_at = CURRENT_TIMESTAMP
  WHERE id = operation_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS para operation_notifications
ALTER TABLE operation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all operation notifications"
ON operation_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'admin_logistics')
  )
);

CREATE POLICY "System can insert operation notifications"
ON operation_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE operation_notifications IS 'Registro de notificaciones por email enviadas para operaciones';
COMMENT ON FUNCTION get_operation_notification_recipients IS 'Obtiene lista de destinatarios para notificaciones de operaciones';
COMMENT ON FUNCTION mark_operation_notified IS 'Marca una operación como notificada';

