-- ============================================
-- MIGRACIÓN: Agregar campo equipment_serial a operations
-- Fecha: Diciembre 2025
-- ============================================

-- Agregar columna equipment_serial a la tabla operations
ALTER TABLE operations
ADD COLUMN IF NOT EXISTS equipment_serial VARCHAR(100);

-- Comentario para documentar el campo
COMMENT ON COLUMN operations.equipment_serial IS 'Serie del equipo a transportar (ingresado por el usuario)';

