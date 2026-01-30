-- ============================================
-- CREAR USUARIO ADMIN lgarcia@partequipos.com (MISMOS PERMISOS QUE admin@partequipos.com)
-- ============================================
-- Este script configura lgarcia@partequipos.com con rol 'admin',
-- mismo que admin@partequipos.com (acceso completo transporte).
--
-- IMPORTANTE: Primero debes crear el usuario en Supabase Dashboard:
-- Authentication → Users → Add user → Create new user
-- - Email: lgarcia@partequipos.com
-- - Password: Password123!
-- - Auto Confirm User: ✅ (marcar)
-- Luego ejecuta este script en SQL Editor.
-- ============================================

-- Paso 1: Verificar si el usuario existe en auth.users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'lgarcia@partequipos.com';

-- Paso 2: Insertar o actualizar en public.users con rol 'admin'
INSERT INTO public.users (id, email, username, role, full_name, is_active)
SELECT
    au.id,
    'lgarcia@partequipos.com',
    'lgarcia',
    'admin',
    COALESCE(au.raw_user_meta_data->>'full_name', 'L. Garcia'),
    true
FROM auth.users au
WHERE au.email = 'lgarcia@partequipos.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active,
    email = EXCLUDED.email;

-- Paso 3: Sincronizar rol en auth.users (raw_user_meta_data) para que la app lo lea al instante
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'role', 'admin',
    'full_name', COALESCE(raw_user_meta_data->>'full_name', 'L. Garcia'),
    'username', 'lgarcia'
)
WHERE email = 'lgarcia@partequipos.com';

-- Paso 4: Verificar
SELECT
    u.id,
    u.email,
    u.username,
    u.role,
    u.full_name,
    u.is_active
FROM public.users u
INNER JOIN auth.users au ON u.id = au.id
WHERE u.email = 'lgarcia@partequipos.com';

-- ============================================
-- NOTAS
-- ============================================
-- 1. Crea el usuario en Dashboard: Authentication → Add user
--    Email: lgarcia@partequipos.com | Password: Password123!
-- 2. Ejecuta este script en SQL Editor.
-- 3. El rol 'admin' tiene los mismos permisos que admin@partequipos.com
--    (dashboard transporte, equipos, horas, combustible, operaciones, etc.).
