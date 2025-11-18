-- ============================================
-- CORREGIR USUARIOS EN SUPABASE
-- ============================================

-- Paso 1: Actualizar el rol del admin
UPDATE public.users 
SET role = 'admin'
WHERE email = 'admin@partequipos.co' OR email = 'admin@partequipos.com';

-- Paso 2: Verificar usuarios en auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('admin@partequipos.co', 'admin@partequipos.com', 'user1@partequipos.com', 'invitado@partequipos.com')
ORDER BY email;

-- Paso 3: Verificar que los usuarios estén sincronizados
SELECT 
    u.id,
    u.email,
    u.username,
    u.role,
    u.is_active,
    CASE 
        WHEN au.id IS NOT NULL THEN '✅ Existe en auth.users'
        ELSE '❌ NO existe en auth.users'
    END as auth_status
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email IN ('admin@partequipos.co', 'admin@partequipos.com', 'user1@partequipos.com', 'invitado@partequipos.com')
ORDER BY u.email;

-- Paso 4: Si algún usuario NO existe en auth.users, necesitas crearlo desde el Dashboard
-- Authentication → Users → Add user → Create new user

