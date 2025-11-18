-- ============================================
-- CORREGIR EMAIL DEL ADMIN
-- Opción: Cambiar admin@partequipos.co a admin@partequipos.com
-- ============================================

-- IMPORTANTE: Si cambias el email aquí, también debes cambiarlo en auth.users
-- O mejor, actualiza el email directamente en Supabase Dashboard:
-- Authentication → Users → Click en el usuario → Edit → Cambiar email

-- Opción 1: Actualizar solo en public.users (NO recomendado, puede causar problemas)
-- UPDATE public.users 
-- SET email = 'admin@partequipos.com'
-- WHERE email = 'admin@partequipos.co';

-- Opción 2: Actualizar en auth.users (RECOMENDADO - desde Dashboard)
-- Ve a Authentication → Users → Click en admin@partequipos.co → Edit → Cambiar email a admin@partequipos.com

-- Después de cambiar el email en auth.users, actualiza public.users:
UPDATE public.users 
SET email = 'admin@partequipos.com'
WHERE id = '42592efb-b6c7-4037-aa14-a2c2f61ff8e8';

-- Verificar el cambio
SELECT id, email, username, role FROM public.users WHERE username = 'admin';

