-- ============================================
-- CREAR USUARIOS EN SUPABASE
-- Ejecutar este script DESPUÉS de crear usuarios en Authentication
-- ============================================

-- IMPORTANTE: Primero debes crear los usuarios en Supabase Dashboard:
-- Authentication → Users → Add user → Create new user
--
-- Luego ejecuta este script para actualizar sus roles y datos

-- ============================================
-- PASO 1: Verificar usuarios existentes en auth.users
-- ============================================
-- Ejecuta esto primero para ver los IDs de los usuarios:
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- ============================================
-- PASO 2: Actualizar roles de usuarios
-- ============================================
-- Reemplaza los IDs con los que obtuviste en el PASO 1

-- Actualizar admin
UPDATE public.users 
SET 
    role = 'admin', 
    username = 'admin',
    full_name = 'Administrador Sistema',
    is_active = true
WHERE email = 'admin@partequipos.com';

-- Actualizar usuario normal
UPDATE public.users 
SET 
    role = 'user', 
    username = 'user1',
    full_name = 'Usuario Operativo',
    is_active = true
WHERE email = 'user1@partequipos.com';

-- Actualizar comercial
UPDATE public.users 
SET 
    role = 'commercial', 
    username = 'comercial',
    full_name = 'Usuario Comercial',
    is_active = true
WHERE email = 'comercial@partequipos.com';

-- Actualizar invitado
UPDATE public.users 
SET 
    role = 'guest', 
    username = 'invitado',
    full_name = 'Usuario Invitado',
    is_active = true
WHERE email = 'invitado@partequipos.com';

-- ============================================
-- PASO 3: Si el usuario no existe en public.users, crearlo manualmente
-- ============================================
-- Si el trigger no funcionó, puedes crear el usuario manualmente:
-- (Reemplaza USER_ID_AQUI con el ID real de auth.users)

-- INSERT INTO public.users (id, email, username, role, full_name, is_active)
-- VALUES (
--     'USER_ID_AQUI',  -- ID de auth.users
--     'admin@partequipos.com',
--     'admin',
--     'admin',
--     'Administrador Sistema',
--     true
-- )
-- ON CONFLICT (id) DO UPDATE SET
--     role = EXCLUDED.role,
--     username = EXCLUDED.username,
--     full_name = EXCLUDED.full_name;

-- ============================================
-- PASO 4: Verificar que los usuarios estén correctos
-- ============================================
SELECT 
    u.id,
    u.email,
    u.username,
    u.role,
    u.full_name,
    u.is_active,
    au.email as auth_email
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
ORDER BY u.email;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Los usuarios DEBEN crearse primero en Authentication Dashboard
-- 2. El trigger handle_new_user() debería sincronizarlos automáticamente
-- 3. Si el trigger no funciona, usa el INSERT manual del PASO 3
-- 4. Las contraseñas se manejan en Supabase Authentication, NO en public.users
-- 5. Para cambiar contraseñas, usa el Dashboard de Supabase o resetea desde la app

