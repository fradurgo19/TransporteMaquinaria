-- ============================================
-- SCRIPT: Agregar política RLS para DELETE en tabla machines
-- ============================================
-- Este script agrega la política RLS necesaria para que los administradores
-- puedan eliminar registros de la tabla machines
-- ============================================

-- Eliminar política si existe (para evitar duplicados)
DROP POLICY IF EXISTS "Admins can delete machines" ON machines;

-- Crear política para que solo administradores puedan eliminar máquinas
CREATE POLICY "Admins can delete machines"
ON machines
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'admin_logistics')
  )
);

-- Comentario
COMMENT ON POLICY "Admins can delete machines" ON machines IS 
'Permite a usuarios con rol admin o admin_logistics eliminar registros de máquinas';

