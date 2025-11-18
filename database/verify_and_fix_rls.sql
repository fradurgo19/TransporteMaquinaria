-- ============================================
-- VERIFICAR Y CORREGIR POLÍTICAS RLS PARA USERS
-- ============================================

-- Paso 1: Ver políticas actuales
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Paso 2: Eliminar políticas existentes si hay problemas
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.users;

-- Paso 3: Crear política correcta para SELECT
-- Esta política permite que los usuarios vean su propio perfil usando auth.uid()
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Paso 4: Crear política para UPDATE
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Paso 5: Verificar que RLS esté habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Paso 6: Probar la consulta como el usuario autenticado
-- Esto simula lo que hace la aplicación
-- NOTA: Esto solo funciona si estás autenticado como ese usuario
SELECT * FROM public.users WHERE id = 'a5060cc3-4193-4c3f-9aed-a290933fcb44';

-- Paso 7: Verificar que el trigger de sincronización esté funcionando
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' 
  AND trigger_schema = 'auth';

