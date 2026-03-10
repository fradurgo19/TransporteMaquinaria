-- ============================================
-- FIX: KPG de Fábrica - permission denied for table users
-- ============================================
-- admin.logistica@partequipos.com (admin_logistics) falla al agregar/ver KPG
-- porque las políticas de manufacturer_kpg usan auth.users, a la que
-- el rol authenticated no tiene SELECT en Supabase.
-- Solución: usar public.users (rol fuente de verdad) y asegurar permisos.
-- ============================================

-- 1. Permitir que el rol authenticated pueda leer public.users (necesario para RLS en otras tablas)
GRANT SELECT ON public.users TO authenticated;

-- 2. Asegurar RLS en public.users: cualquier autenticado puede leer al menos su fila
--    (necesario para que EXISTS (SELECT 1 FROM public.users WHERE ...) funcione en manufacturer_kpg)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "TEMP: Authenticated users can view all profiles" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 3. Políticas de manufacturer_kpg usando public.users (admin y admin_logistics)
DROP POLICY IF EXISTS "Admins can view manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can view manufacturer_kpg"
  ON manufacturer_kpg
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can insert manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can insert manufacturer_kpg"
  ON manufacturer_kpg
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can update manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can update manufacturer_kpg"
  ON manufacturer_kpg
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can delete manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can delete manufacturer_kpg"
  ON manufacturer_kpg
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_logistics')
    )
  );

-- 4. Verificar políticas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('users', 'manufacturer_kpg')
ORDER BY tablename, policyname;
