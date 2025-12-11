-- ============================================
-- SCRIPT: Aislamiento de Datos por Usuario
-- ============================================
-- Este script actualiza las políticas RLS para que:
-- 1. Usuarios normales solo vean sus propios registros (created_by = auth.uid())
-- 2. Administradores puedan ver todos los registros
-- ============================================

-- Eliminar políticas existentes que no son correctas
DROP POLICY IF EXISTS "Users can manage own operation hours" ON public.operation_hours;
DROP POLICY IF EXISTS "Users can manage own fuel logs" ON public.fuel_logs;
DROP POLICY IF EXISTS "Authenticated users can manage operations" ON public.operations;
DROP POLICY IF EXISTS "Authenticated users can manage checklists" ON public.pre_operational_checklists;

-- ============================================
-- POLÍTICAS PARA operation_hours
-- ============================================

-- SELECT: Usuarios ven solo sus registros, admins ven todos
CREATE POLICY "Users can view own operation hours, admins view all"
    ON public.operation_hours FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- INSERT: Usuarios pueden crear registros (se asigna created_by automáticamente)
CREATE POLICY "Users can insert operation hours"
    ON public.operation_hours FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Usuarios pueden actualizar solo sus registros, admins pueden actualizar todos
CREATE POLICY "Users can update own operation hours, admins update all"
    ON public.operation_hours FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- DELETE: Usuarios pueden eliminar solo sus registros, admins pueden eliminar todos
CREATE POLICY "Users can delete own operation hours, admins delete all"
    ON public.operation_hours FOR DELETE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- POLÍTICAS PARA fuel_logs
-- ============================================

-- SELECT: Usuarios ven solo sus registros, admins ven todos
CREATE POLICY "Users can view own fuel logs, admins view all"
    ON public.fuel_logs FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- INSERT: Usuarios pueden crear registros (se asigna created_by automáticamente)
CREATE POLICY "Users can insert fuel logs"
    ON public.fuel_logs FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Usuarios pueden actualizar solo sus registros, admins pueden actualizar todos
CREATE POLICY "Users can update own fuel logs, admins update all"
    ON public.fuel_logs FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- DELETE: Usuarios pueden eliminar solo sus registros, admins pueden eliminar todos
CREATE POLICY "Users can delete own fuel logs, admins delete all"
    ON public.fuel_logs FOR DELETE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- POLÍTICAS PARA operations
-- ============================================

-- SELECT: Usuarios ven solo sus registros, admins ven todos
CREATE POLICY "Users can view own operations, admins view all"
    ON public.operations FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- INSERT: Usuarios pueden crear registros (se asigna created_by automáticamente)
CREATE POLICY "Users can insert operations"
    ON public.operations FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Usuarios pueden actualizar solo sus registros, admins pueden actualizar todos
CREATE POLICY "Users can update own operations, admins update all"
    ON public.operations FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- DELETE: Usuarios pueden eliminar solo sus registros, admins pueden eliminar todos
CREATE POLICY "Users can delete own operations, admins delete all"
    ON public.operations FOR DELETE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- POLÍTICAS PARA pre_operational_checklists
-- ============================================

-- SELECT: Usuarios ven solo sus registros, admins ven todos
CREATE POLICY "Users can view own checklists, admins view all"
    ON public.pre_operational_checklists FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- INSERT: Usuarios pueden crear registros (se asigna created_by automáticamente)
CREATE POLICY "Users can insert checklists"
    ON public.pre_operational_checklists FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Usuarios pueden actualizar solo sus registros, admins pueden actualizar todos
CREATE POLICY "Users can update own checklists, admins update all"
    ON public.pre_operational_checklists FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- DELETE: Usuarios pueden eliminar solo sus registros, admins pueden eliminar todos
CREATE POLICY "Users can delete own checklists, admins delete all"
    ON public.pre_operational_checklists FOR DELETE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Para verificar las políticas creadas, ejecutar:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('operation_hours', 'fuel_logs', 'operations', 'pre_operational_checklists')
-- ORDER BY tablename, policyname;

