-- ============================================
-- ACTUALIZAR METADATOS DE USUARIOS EN AUTH.USERS
-- Esto permite que el fallback funcione correctamente
-- ============================================

-- Paso 1: Ver usuarios actuales
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email IN ('admin@partequipos.com', 'user1@partequipos.com', 'invitado@partequipos.com');

-- Paso 2: Actualizar metadatos del admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'username', 'admin',
    'role', 'admin',
    'full_name', 'Administrador Sistema'
)
WHERE email = 'admin@partequipos.com';

-- Paso 3: Actualizar metadatos del usuario normal
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'username', 'user1',
    'role', 'user',
    'full_name', 'Usuario Operativo'
)
WHERE email = 'user1@partequipos.com';

-- Paso 4: Actualizar metadatos del invitado
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'username', 'invitado',
    'role', 'guest',
    'full_name', 'Usuario Invitado'
)
WHERE email = 'invitado@partequipos.com';

-- Paso 5: Verificar cambios
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email IN ('admin@partequipos.com', 'user1@partequipos.com', 'invitado@partequipos.com');

