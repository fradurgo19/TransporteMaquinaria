-- ============================================
-- PERMITIR ACCESO DE LECTURA A MÁQUINAS PARA USUARIOS COMERCIALES
-- ============================================
-- Este script asegura que los usuarios comerciales puedan ver las máquinas
-- para poder crear solicitudes de transporte, pero sin permisos de escritura
-- ============================================

-- Verificar políticas actuales
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
WHERE tablename = 'machines'
ORDER BY policyname;

-- La política "Anyone can view machines" ya debería permitir que comerciales vean máquinas
-- Pero si hay problemas, la recreamos explícitamente para asegurar que funciona
DROP POLICY IF EXISTS "Anyone can view machines" ON machines;
CREATE POLICY "Anyone can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (true);

-- Verificar que las políticas están activas
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'machines'
ORDER BY policyname;

-- ============================================
-- NOTAS:
-- ============================================
-- 1. Los usuarios comerciales pueden VER (SELECT) máquinas
-- 2. Los usuarios comerciales NO pueden INSERT, UPDATE o DELETE máquinas
-- 3. Solo admins pueden modificar máquinas (según las políticas existentes)
-- 4. El módulo "Gestión de Máquinas" en el frontend solo es visible para admins
-- 5. Los comerciales pueden acceder a la información de máquinas desde el formulario
--    de solicitudes de transporte
-- ============================================
