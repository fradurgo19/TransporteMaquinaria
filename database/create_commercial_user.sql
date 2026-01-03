-- ============================================
-- CREAR USUARIO COMERCIAL EN SUPABASE
-- ============================================
-- Este script configura el usuario comercial@partequipos.com
-- para que solo pueda ver el módulo de solicitudes de transporte
--
-- IMPORTANTE: Primero debes crear el usuario en Supabase Dashboard:
-- Authentication → Users → Add user → Create new user
-- - Email: comercial@partequipos.com
-- - Password: [Contraseña segura]
-- - Auto Confirm User: ✅ (marcar)
-- ============================================

-- Paso 1: Verificar si el usuario existe en auth.users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users 
WHERE email = 'comercial@partequipos.com';

-- Paso 2: Si el usuario existe, actualizar su rol en public.users
-- NOTA: Si el usuario no existe en public.users, se creará automáticamente
-- por el trigger handle_new_user(), pero podemos asegurarlo manualmente:

-- Actualizar o insertar el usuario en public.users
INSERT INTO public.users (id, email, username, role, full_name, is_active)
SELECT 
    au.id,
    'comercial@partequipos.com',
    'comercial',
    'commercial',
    'Usuario Comercial',
    true
FROM auth.users au
WHERE au.email = 'comercial@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active,
    email = EXCLUDED.email;

-- Paso 3: Actualizar el raw_user_meta_data en auth.users para incluir el rol
-- Esto ayuda a que la aplicación obtenga el rol más rápido
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'role', 'commercial',
    'full_name', 'Usuario Comercial',
    'username', 'comercial'
)
WHERE email = 'comercial@partequipos.com';

-- Paso 4: Verificar que el usuario esté correctamente configurado
SELECT 
    u.id,
    u.email,
    u.username,
    u.role,
    u.full_name,
    u.is_active,
    au.email as auth_email
FROM public.users u
INNER JOIN auth.users au ON u.id = au.id
WHERE u.email = 'comercial@partequipos.com';

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. El usuario DEBE crearse primero en Authentication Dashboard
-- 2. Este script actualiza/crea el registro en public.users
-- 3. Las políticas RLS ya están configuradas en transport_requests_setup.sql
--    para permitir que usuarios comerciales:
--    - Vean sus propias solicitudes
--    - Crear nuevas solicitudes
-- 4. El usuario comercial NO puede:
--    - Ver otras tablas (equipment, operations, etc.)
--    - Actualizar solicitudes creadas por otros
--    - Eliminar solicitudes
-- 5. Solo los admins pueden actualizar/eliminar solicitudes
-- ============================================

-- ============================================
-- VERIFICACIÓN DE POLÍTICAS RLS PARA COMERCIAL
-- ============================================
-- Verificar que las políticas RLS estén activas para transport_requests:
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
WHERE tablename = 'transport_requests'
ORDER BY policyname;

-- Las políticas deberían incluir:
-- 1. "Users can view their own requests" - permite ver solicitudes propias o todas si es admin
-- 2. "Commercial users can create requests" - permite crear solicitudes si es commercial/admin
-- 3. "Admins can update requests" - solo admins pueden actualizar
