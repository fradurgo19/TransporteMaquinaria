-- ============================================
-- Quitar política que da acceso total a transport_requests
-- ============================================
-- "Authenticated users can manage transport requests" (ALL) permite a cualquier
-- usuario autenticado (incl. admin_logistics) ver/actualizar todo. Para que solo
-- admin (transporte) vea y actualice, hay que eliminar esta política.
-- Ejecutar una vez en Supabase SQL Editor.
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can manage transport requests" ON transport_requests;

-- Verificar: no debe aparecer "Authenticated users can manage transport requests"
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'transport_requests'
ORDER BY policyname;
