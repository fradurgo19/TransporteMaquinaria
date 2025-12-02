-- ============================================
-- SETUP PARA MÓDULO DE LOGÍSTICA
-- ============================================
-- IMPORTANTE: No usar ALTER TYPE en Supabase, usar VARCHAR directamente

-- 1. Agregar columna department a tablas existentes
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
ALTER TABLE operation_hours ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
-- ALTER TABLE checklists ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport'; -- Tabla no existe aún

-- 2. Crear tablas para logística
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  delivery_address TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_vehicle VARCHAR(20),
  assigned_driver VARCHAR(255),
  pickup_date TIMESTAMP,
  delivery_date TIMESTAMP,
  notes TEXT,
  department VARCHAR(50) DEFAULT 'logistics',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tracking_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_department ON deliveries(department);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);

-- 4. Crear usuarios de logística en Supabase Auth
-- NOTA: Esto debe hacerse desde Supabase Dashboard → Authentication → Users
-- O ejecutar después de tener acceso a auth.users

-- 5. Políticas RLS para deliveries
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Usuarios de logística pueden ver todas las entregas
CREATE POLICY "Logistics users can view deliveries"
ON deliveries
FOR SELECT
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'logistics'
  )
);

-- Usuarios de logística pueden crear entregas
CREATE POLICY "Logistics users can create deliveries"
ON deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'logistics'
  )
);

-- Usuarios de logística pueden actualizar entregas
CREATE POLICY "Logistics users can update deliveries"
ON deliveries
FOR UPDATE
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'logistics'
  )
);

-- Tracking visible para usuarios de logística
CREATE POLICY "Logistics users can view tracking"
ON delivery_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM deliveries 
    WHERE deliveries.id = delivery_tracking.delivery_id 
    AND deliveries.department = 'logistics'
  ) AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'logistics'
  )
);

-- Agregar tracking
CREATE POLICY "Logistics users can add tracking"
ON delivery_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'logistics'
  )
);

-- 6. Actualizar políticas RLS existentes para filtrar por department
-- Equipment
DROP POLICY IF EXISTS "authenticated_read_active_equipment" ON equipment;
CREATE POLICY "Users can read equipment from their department"
ON equipment
FOR SELECT
TO authenticated
USING (
  (department = 'transport' AND status = 'active') OR
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'logistics'
  ))
);

-- Fuel logs
DROP POLICY IF EXISTS "Users can read fuel logs from their department" ON fuel_logs;
CREATE POLICY "Users can read fuel logs from their department"
ON fuel_logs
FOR SELECT
TO authenticated
USING (
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'user')
  )) OR
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'logistics'
  ))
);

-- Operation hours
DROP POLICY IF EXISTS "Users can read operation hours from their department" ON operation_hours;
CREATE POLICY "Users can read operation hours from their department"
ON operation_hours
FOR SELECT
TO authenticated
USING (
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'user')
  )) OR
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'logistics'
  ))
);

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_deliveries_updated_at();

-- 8. Función para generar tracking number automático
CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'LOG' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE deliveries IS 'Entregas de logística';
COMMENT ON TABLE delivery_tracking IS 'Historial de tracking de entregas';

