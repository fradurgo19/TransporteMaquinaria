-- Agregar campo para días compensatorios
ALTER TABLE operation_hours ADD COLUMN IF NOT EXISTS is_compensatory BOOLEAN DEFAULT FALSE;
ALTER TABLE operation_hours ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE operation_hours ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN operation_hours.is_compensatory IS 'Marca si el día es compensatorio (sin trabajo)';
COMMENT ON COLUMN operation_hours.created_by_admin IS 'Indica si el registro fue creado manualmente por el admin';
COMMENT ON COLUMN operation_hours.notes IS 'Notas adicionales del registro';

-- Política para que admin pueda crear registros de cualquier usuario
DROP POLICY IF EXISTS "Admin can create operation hours for any user" ON operation_hours;
CREATE POLICY "Admin can create operation hours for any user"
ON operation_hours
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'admin_logistics')
  )
);

