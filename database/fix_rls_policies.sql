-- ============================================
-- VERIFICAR Y CORREGIR POLÍTICAS RLS
-- ============================================

-- Paso 1: Verificar políticas actuales
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
WHERE tablename = 'users'
ORDER BY policyname;

-- Paso 2: Eliminar políticas existentes si es necesario (opcional)
-- DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Paso 3: Crear políticas más permisivas para debugging
-- Política: Permitir que usuarios autenticados vean su propio perfil
CREATE POLICY IF NOT EXISTS "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Política alternativa: Permitir que todos los usuarios autenticados vean todos los perfiles (solo para debugging)
-- COMENTAR ESTA LÍNEA DESPUÉS DE VERIFICAR QUE FUNCIONA
-- CREATE POLICY IF NOT EXISTS "Authenticated users can view all profiles"
--     ON public.users FOR SELECT
--     USING (auth.role() = 'authenticated');

-- Paso 4: Verificar que RLS esté habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Paso 5: Verificar usuario actual
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    pu.id as public_id,
    pu.email as public_email,
    pu.role,
    pu.username
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'admin@partequipos.com';

-- Paso 6: Si el usuario no existe en public.users, crearlo manualmente
-- (Reemplaza USER_ID con el ID de auth.users)
-- INSERT INTO public.users (id, email, username, role, full_name, is_active)
-- VALUES (
--     'USER_ID_AQUI',
--     'admin@partequipos.com',
--     'admin',
--     'admin',
--     'Administrador Sistema',
--     true
-- )
-- ON CONFLICT (id) DO UPDATE SET
--     role = EXCLUDED.role,
--     username = EXCLUDED.username;

