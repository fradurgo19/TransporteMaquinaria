-- ============================================
-- CREAR ADMINISTRADOR DE LOGÍSTICA
-- ============================================

-- 1. Actualizar constraint para incluir admin_logistics
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'user', 'guest', 'commercial', 'logistics', 'admin_logistics'));

-- 2. Crear usuario administrador de logística en Supabase Auth
-- NOTA: Esto debe hacerse manualmente en Supabase Dashboard → Authentication → Users
-- Email: admin.logistica@partequipos.com
-- Password: Password123!

-- 3. Actualizar el rol del usuario (ejecutar DESPUÉS de crear en Auth)
UPDATE users 
SET role = 'admin_logistics' 
WHERE email = 'admin.logistica@partequipos.com';

-- 4. Actualizar políticas RLS para admin_logistics

-- Equipment: admin_logistics puede gestionar equipos de logística
DROP POLICY IF EXISTS "Admin logistics can manage logistics equipment" ON equipment;
CREATE POLICY "Admin logistics can manage logistics equipment"
ON equipment
FOR ALL
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  )
);

-- Deliveries: admin_logistics tiene acceso completo
DROP POLICY IF EXISTS "Admin logistics can manage all deliveries" ON deliveries;
CREATE POLICY "Admin logistics can manage all deliveries"
ON deliveries
FOR ALL
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  )
);

-- Delivery tracking: admin_logistics tiene acceso completo
DROP POLICY IF EXISTS "Admin logistics can manage all tracking" ON delivery_tracking;
CREATE POLICY "Admin logistics can manage all tracking"
ON delivery_tracking
FOR ALL
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
    AND users.role = 'admin_logistics'
  )
);

-- Fuel logs: admin_logistics puede ver y gestionar de logística
DROP POLICY IF EXISTS "Admin logistics can manage logistics fuel" ON fuel_logs;
CREATE POLICY "Admin logistics can manage logistics fuel"
ON fuel_logs
FOR ALL
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  )
);

-- Operation hours: admin_logistics puede ver y gestionar de logística
DROP POLICY IF EXISTS "Admin logistics can manage logistics hours" ON operation_hours;
CREATE POLICY "Admin logistics can manage logistics hours"
ON operation_hours
FOR ALL
TO authenticated
USING (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  )
);

-- Verificar
SELECT email, role FROM users WHERE role IN ('admin_logistics', 'logistics');

COMMENT ON ROLE admin_logistics IS 'Administrador del departamento de logística';

