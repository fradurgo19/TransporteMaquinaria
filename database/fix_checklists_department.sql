-- ============================================
-- AGREGAR CAMPO DEPARTMENT A CHECKLISTS Y POLÍTICAS RLS
-- ============================================
-- Este script agrega el campo department a pre_operational_checklists
-- y crea políticas RLS para filtrar por departamento

-- 1. Agregar columna department si no existe
ALTER TABLE pre_operational_checklists 
ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';

-- 2. Actualizar checklists existentes sin department
UPDATE pre_operational_checklists 
SET department = 'transport' 
WHERE department IS NULL;

-- 3. Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_checklists_department ON pre_operational_checklists(department);

-- 4. Actualizar políticas RLS para filtrar por departamento

-- Eliminar política antigua si existe
DROP POLICY IF EXISTS "Authenticated users can manage checklists" ON pre_operational_checklists;
DROP POLICY IF EXISTS "Users can view own checklists, admins view all" ON pre_operational_checklists;
DROP POLICY IF EXISTS "Users can insert checklists" ON pre_operational_checklists;
DROP POLICY IF EXISTS "Users can update own checklists, admins update all" ON pre_operational_checklists;
DROP POLICY IF EXISTS "Users can delete own checklists, admins delete all" ON pre_operational_checklists;

-- Política de SELECT: Usuarios solo ven checklists de su departamento
CREATE POLICY "Users can view checklists from their department"
ON pre_operational_checklists
FOR SELECT
TO authenticated
USING (
  -- Usuarios de transporte ven checklists de transporte
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  -- Usuarios de logística ven checklists de logística
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
);

-- Política de INSERT: Usuarios solo pueden crear checklists en su departamento
CREATE POLICY "Users can insert checklists in their department"
ON pre_operational_checklists
FOR INSERT
TO authenticated
WITH CHECK (
  -- Usuarios de transporte crean checklists de transporte
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  -- Usuarios de logística crean checklists de logística
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
);

-- Política de UPDATE: Usuarios solo pueden actualizar checklists de su departamento
CREATE POLICY "Users can update checklists from their department"
ON pre_operational_checklists
FOR UPDATE
TO authenticated
USING (
  -- Usuarios de transporte actualizan checklists de transporte
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )) OR
  -- Usuarios de logística actualizan checklists de logística
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('logistics', 'admin_logistics')
  ))
)
WITH CHECK (
  -- Asegurar que no se cambie el departamento
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

-- Política de DELETE: Solo admins pueden eliminar checklists de su departamento
CREATE POLICY "Admins can delete checklists from their department"
ON pre_operational_checklists
FOR DELETE
TO authenticated
USING (
  -- Admin de transporte elimina checklists de transporte
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )) OR
  -- Admin de logística elimina checklists de logística
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin_logistics'
  ))
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
WHERE tablename = 'pre_operational_checklists'
ORDER BY policyname;
