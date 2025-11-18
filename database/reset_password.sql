-- ============================================
-- RESETEAR CONTRASEÑA O CREAR NUEVO USUARIO
-- ============================================

-- ============================================
-- OPCIÓN 1: Verificar estado del usuario actual
-- ============================================
SELECT 
    id,
    email,
    email_confirmed_at,
    encrypted_password IS NOT NULL as has_password,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'admin@partequipos.co';

-- ============================================
-- OPCIÓN 2: Crear un nuevo usuario admin desde SQL
-- ============================================
-- NOTA: Esto requiere permisos de service_role, mejor hacerlo desde Dashboard

-- ============================================
-- OPCIÓN 3: ELIMINAR y RECREAR el usuario (MÁS FÁCIL)
-- ============================================

-- Paso 1: Eliminar el usuario actual (esto eliminará también el registro en public.users por CASCADE)
DELETE FROM auth.users WHERE email = 'admin@partequipos.co';

-- Paso 2: Crear nuevo usuario desde Dashboard:
-- Authentication → Users → Add user → Create new user
-- Email: admin@partequipos.com
-- Password: Password123!
-- Auto Confirm User: ✅

-- Paso 3: Después de crear, actualizar el rol:
UPDATE public.users 
SET role = 'admin', username = 'admin', full_name = 'Administrador Sistema'
WHERE email = 'admin@partequipos.com';

-- ============================================
-- OPCIÓN 4: Usar función de Supabase para resetear contraseña
-- ============================================
-- Esto se hace mejor desde el Dashboard:
-- Authentication → Users → Click en usuario → "Send password reset email"

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT 
    au.id,
    au.email,
    au.email_confirmed_at IS NOT NULL as is_confirmed,
    pu.role,
    pu.username,
    pu.is_active
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email LIKE '%admin%'
ORDER BY au.created_at DESC;

