-- ============================================
-- TABLA PARA KPG DE FÁBRICA (MANUFACTURER KPG)
-- ============================================

-- Crear tabla para almacenar KPG de fábrica según fabricante, marca, modelo y año
CREATE TABLE IF NOT EXISTS manufacturer_kpg (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer VARCHAR(100) NOT NULL, -- Fabricante (ej: INTERNATIONAL, VOLVO, MACK)
  brand VARCHAR(100) NOT NULL, -- Marca
  model VARCHAR(100) NOT NULL, -- Modelo
  vehicle_type VARCHAR(50) NOT NULL, -- Tipo de vehículo (tractor, trailer, etc.)
  year INTEGER, -- Año del vehículo (opcional)
  kpg DECIMAL(10, 2) NOT NULL, -- Km/Galón según especificaciones de fábrica
  notes TEXT, -- Notas adicionales
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(manufacturer, brand, model, vehicle_type, year)
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_manufacturer_kpg_brand ON manufacturer_kpg(brand);
CREATE INDEX IF NOT EXISTS idx_manufacturer_kpg_model ON manufacturer_kpg(model);
CREATE INDEX IF NOT EXISTS idx_manufacturer_kpg_vehicle_type ON manufacturer_kpg(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_manufacturer_kpg_year ON manufacturer_kpg(year);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_manufacturer_kpg_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS manufacturer_kpg_updated_at ON manufacturer_kpg;
CREATE TRIGGER manufacturer_kpg_updated_at
  BEFORE UPDATE ON manufacturer_kpg
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_kpg_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE manufacturer_kpg ENABLE ROW LEVEL SECURITY;

-- Política: Solo administradores pueden ver, insertar, actualizar y eliminar
DROP POLICY IF EXISTS "Admins can view manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can view manufacturer_kpg"
  ON manufacturer_kpg
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin' 
           OR auth.users.raw_user_meta_data->>'role' = 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can insert manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can insert manufacturer_kpg"
  ON manufacturer_kpg
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin' 
           OR auth.users.raw_user_meta_data->>'role' = 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can update manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can update manufacturer_kpg"
  ON manufacturer_kpg
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin' 
           OR auth.users.raw_user_meta_data->>'role' = 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can delete manufacturer_kpg" ON manufacturer_kpg;
CREATE POLICY "Admins can delete manufacturer_kpg"
  ON manufacturer_kpg
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin' 
           OR auth.users.raw_user_meta_data->>'role' = 'admin_logistics')
    )
  );

-- Comentarios en la tabla
COMMENT ON TABLE manufacturer_kpg IS 'Almacena los KPG (Km/Galón) de fábrica según especificaciones del fabricante';
COMMENT ON COLUMN manufacturer_kpg.manufacturer IS 'Fabricante del vehículo (ej: INTERNATIONAL, VOLVO, MACK)';
COMMENT ON COLUMN manufacturer_kpg.brand IS 'Marca del vehículo';
COMMENT ON COLUMN manufacturer_kpg.model IS 'Modelo del vehículo';
COMMENT ON COLUMN manufacturer_kpg.vehicle_type IS 'Tipo de vehículo (tractor, trailer, etc.)';
COMMENT ON COLUMN manufacturer_kpg.year IS 'Año del vehículo (opcional, puede ser NULL para rangos de años)';
COMMENT ON COLUMN manufacturer_kpg.kpg IS 'Km/Galón según especificaciones de fábrica';

