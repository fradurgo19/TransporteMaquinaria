-- ============================================
-- ACTUALIZAR POLÍTICAS RLS PARA ADMIN_LOGISTICS
-- ============================================
-- Este script actualiza las políticas RLS para permitir que admin_logistics
-- pueda ver y gestionar equipos de logística correctamente

-- 1. Actualizar política de lectura de equipment para incluir admin_logistics
-- IMPORTANTE: Cada departamento solo puede ver sus propios equipos
DROP POLICY IF EXISTS "Users can read equipment from their department" ON equipment;
CREATE POLICY "Users can read equipment from their department"
ON equipment
FOR SELECT
TO authenticated
USING (
  -- Usuarios de transporte solo ven equipos de transporte
  (department = 'transport' AND status = 'active' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  -- Usuarios de logística solo ven equipos de logística
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
);

-- 2. Actualizar política de lectura de fuel_logs para incluir admin_logistics
DROP POLICY IF EXISTS "Users can read fuel logs from their department" ON fuel_logs;
CREATE POLICY "Users can read fuel logs from their department"
ON fuel_logs
FOR SELECT
TO authenticated
USING (
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
);

-- 3. Actualizar política de lectura de operation_hours para incluir admin_logistics
DROP POLICY IF EXISTS "Users can read operation hours from their department" ON operation_hours;
CREATE POLICY "Users can read operation hours from their department"
ON operation_hours
FOR SELECT
TO authenticated
USING (
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
);

-- 4. Verificar que las políticas de admin_logistics para gestión (INSERT, UPDATE, DELETE) estén activas
-- Estas políticas ya están en create_admin_logistics.sql, pero las verificamos aquí

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
)
WITH CHECK (
  department = 'logistics' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  )
);

-- Verificar políticas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('equipment', 'fuel_logs', 'operation_hours', 'deliveries')
ORDER BY tablename, policyname;
