-- ============================================
-- AISLAMIENTO POR DEPARTAMENTO
-- ============================================
-- Regla: lo que registran usuarios de logística solo lo ven ellos;
-- lo que registran usuarios estándar (transporte) solo lo ven ellos.
-- admin@partequipos.com (transporte) y admin.logistica@partequipos.com (logística)
-- no mezclan datos.
-- ============================================

-- ---------- 1. MANUFACTURER_KPG: columna department y RLS por departamento ----------
ALTER TABLE manufacturer_kpg ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'transport';
UPDATE manufacturer_kpg SET department = 'transport' WHERE department IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturer_kpg_department ON manufacturer_kpg(department);

-- Unicidad por (manufacturer, brand, model, vehicle_type, year, department)
DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'manufacturer_kpg' AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.manufacturer_kpg DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;
ALTER TABLE manufacturer_kpg ADD CONSTRAINT manufacturer_kpg_uniq_department
  UNIQUE (manufacturer, brand, model, vehicle_type, year, department);

-- Políticas: admin solo ve/gestiona department = 'transport'; admin_logistics solo 'logistics'
DROP POLICY IF EXISTS "Admins can view manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can view manufacturer_kpg"
  ON manufacturer_kpg FOR SELECT TO authenticated
  USING (
    (department = 'transport' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
    OR
    (department = 'logistics' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin_logistics'))
  );

DROP POLICY IF EXISTS "Admins can insert manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can insert manufacturer_kpg"
  ON manufacturer_kpg FOR INSERT TO authenticated
  WITH CHECK (
    (department = 'transport' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
    OR
    (department = 'logistics' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin_logistics'))
  );

DROP POLICY IF EXISTS "Admins can update manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can update manufacturer_kpg"
  ON manufacturer_kpg FOR UPDATE TO authenticated
  USING (
    (department = 'transport' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
    OR
    (department = 'logistics' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin_logistics'))
  );

DROP POLICY IF EXISTS "Admins can delete manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can delete manufacturer_kpg"
  ON manufacturer_kpg FOR DELETE TO authenticated
  USING (
    (department = 'transport' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
    OR
    (department = 'logistics' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin_logistics'))
  );

COMMENT ON COLUMN manufacturer_kpg.department IS 'Departamento: transport (estándar) o logistics; aislamiento de datos.';

-- ---------- 2. TRANSPORT_REQUESTS: solo admin (transporte) ve todas y actualiza ----------
-- Logística no debe ver ni gestionar solicitudes de transporte (es módulo de transporte).
-- Quitar política que da ALL a todos los autenticados (rompe el aislamiento).
DROP POLICY IF EXISTS "Authenticated users can manage transport requests" ON transport_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON transport_requests;
CREATE POLICY "Users can view their own requests"
  ON transport_requests FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Commercial users can create requests" ON transport_requests;
CREATE POLICY "Commercial users can create requests"
  ON transport_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('commercial', 'admin'))
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update requests" ON transport_requests;
CREATE POLICY "Admins can update requests"
  ON transport_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Verificación
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('manufacturer_kpg', 'transport_requests')
ORDER BY tablename, policyname;
