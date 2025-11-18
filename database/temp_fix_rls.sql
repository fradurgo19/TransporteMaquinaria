-- ============================================
-- SOLUCIÓN TEMPORAL: Política RLS más permisiva
-- Solo para debugging - luego se debe restringir
-- ============================================

-- Paso 1: Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.users;

-- Paso 2: Crear política temporal PERMISIVA (solo para debugging)
-- ⚠️ ESTO PERMITE QUE CUALQUIER USUARIO AUTENTICADO VEA CUALQUIER PERFIL
-- ⚠️ CAMBIAR DESPUÉS DE VERIFICAR QUE FUNCIONA
CREATE POLICY "TEMP: Authenticated users can view all profiles"
    ON public.users FOR SELECT
    USING (auth.role() = 'authenticated');

-- Paso 3: Política para UPDATE (solo propio perfil)
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Paso 4: Verificar
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users';

-- ============================================
-- DESPUÉS DE VERIFICAR QUE FUNCIONA:
-- ============================================
-- Ejecutar esto para restaurar la política restrictiva:
/*
DROP POLICY IF EXISTS "TEMP: Authenticated users can view all profiles" ON public.users;

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);
*/

