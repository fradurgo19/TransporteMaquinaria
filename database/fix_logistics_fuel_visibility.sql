-- ============================================
-- Combustible en logística: visibilidad por rol
-- - admin_logistics: ve TODOS los registros con department = 'logistics'
-- - logistics (operador): ve solo SUS registros (department = 'logistics' AND created_by = auth.uid())
-- Ejecutar en Supabase después de fix_transport_standard_errors.sql (columna department en fuel_logs).
-- ============================================

-- Asegurar columna department en fuel_logs
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
UPDATE fuel_logs SET department = 'transport' WHERE department IS NULL;

-- Reemplazar política de lectura: logística operador solo ve sus registros
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
    AND (
      users.role = 'admin_logistics'
      OR (users.role = 'logistics' AND fuel_logs.created_by = auth.uid())
    )
  ))
);

-- Política para que operadores de logística puedan INSERTAR con department = 'logistics'
DROP POLICY IF EXISTS "Logistics users can insert fuel logs" ON fuel_logs;
CREATE POLICY "Logistics users can insert fuel logs"
ON fuel_logs
FOR INSERT
TO authenticated
WITH CHECK (
  (department = 'logistics' AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('logistics', 'admin_logistics')
  ))
  OR
  (department = 'transport' AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'user')
  ))
);

-- Política para que operadores de logística puedan ACTUALIZAR/ELIMINAR solo sus registros
-- (admin_logistics ya tiene "Admin logistics can manage logistics fuel" FOR ALL)
DROP POLICY IF EXISTS "Logistics operator can update own fuel logs" ON fuel_logs;
CREATE POLICY "Logistics operator can update own fuel logs"
ON fuel_logs
FOR UPDATE
TO authenticated
USING (
  department = 'logistics' AND created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'logistics'
  )
)
WITH CHECK (
  department = 'logistics' AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Logistics operator can delete own fuel logs" ON fuel_logs;
CREATE POLICY "Logistics operator can delete own fuel logs"
ON fuel_logs
FOR DELETE
TO authenticated
USING (
  department = 'logistics' AND created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'logistics'
  )
);
