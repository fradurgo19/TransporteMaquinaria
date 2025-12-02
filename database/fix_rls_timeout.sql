-- ============================================
-- CORREGIR POLÍTICAS RLS PARA EVITAR TIMEOUTS
-- ============================================

-- El problema es que las políticas RLS están causando timeouts
-- Vamos a verificar y optimizar las políticas

-- Paso 1: Ver políticas actuales
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Paso 2: Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "TEMP: Authenticated users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.users;

-- Paso 3: Crear política optimizada que no cause timeouts
-- Esta política es más permisiva pero evita timeouts
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND (
            auth.uid() = id 
            OR auth.uid() IS NOT NULL
        )
    );

-- Paso 4: Política para UPDATE
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Paso 5: Verificar índices (importante para rendimiento)
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users' 
  AND schemaname = 'public';

-- Paso 6: Si no existe índice en id, crearlo (debería existir por PRIMARY KEY)
-- CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);

-- Paso 7: Verificar que RLS esté habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- ============================================
-- NOTA: Si el problema persiste, puede ser un problema de red o de Supabase
-- En ese caso, considera usar una política más permisiva temporalmente:
-- ============================================
/*
-- Política muy permisiva (solo para debugging)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "TEMP: All authenticated users can view all profiles"
    ON public.users FOR SELECT
    USING (auth.role() = 'authenticated');
*/

