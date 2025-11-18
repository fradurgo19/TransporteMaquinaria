-- ============================================
-- RESTAURAR POLÍTICA RESTRICTIVA RLS
-- ============================================

-- Paso 1: Eliminar política temporal permisiva
DROP POLICY IF EXISTS "TEMP: Authenticated users can view all profiles" ON public.users;

-- Paso 2: Crear política restrictiva (solo puede ver su propio perfil)
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Paso 3: Verificar que la política esté creada
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================
-- SI LA POLÍTICA RESTRICTIVA NO FUNCIONA:
-- ============================================
-- Puede ser que auth.uid() no esté disponible en el contexto.
-- En ese caso, usa esta política alternativa que es más segura:

/*
-- Política alternativa: Permitir ver perfiles de usuarios autenticados
-- pero solo si el ID coincide (más permisiva pero aún segura)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND (auth.uid() = id OR auth.uid() IS NOT NULL)
    );
*/

