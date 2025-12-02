-- Tabla para almacenar datos GPS del proveedor
-- Columnas del Excel: Movil | Alias | Fecha GPS | Fecha Servidor | Localizacion | Mensaje | Lat | Lng
CREATE TABLE IF NOT EXISTS gps_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  overtime_tracking_id UUID REFERENCES overtime_tracking(id) ON DELETE CASCADE,
  movil TEXT NOT NULL,           -- Columna "Movil" (placa del vehículo)
  alias TEXT,                     -- Columna "Alias" (nombre de la empresa)
  fecha_gps TIMESTAMP NOT NULL,  -- Columna "Fecha GPS"
  fecha_servidor TIMESTAMP,      -- Columna "Fecha Servidor"
  localizacion TEXT,             -- Columna "Localizacion"
  mensaje TEXT NOT NULL,          -- Columna "Mensaje"
  lat DECIMAL(10, 7) NOT NULL,   -- Columna "Lat"
  lng DECIMAL(10, 7) NOT NULL,   -- Columna "Lng"
  es_encendido BOOLEAN DEFAULT FALSE,
  es_apagado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_gps_tracking_overtime ON gps_tracking(overtime_tracking_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_movil_fecha ON gps_tracking(movil, fecha_gps);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_fecha ON gps_tracking(fecha_gps);

-- Agregar campos GPS a overtime_tracking
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_entrada TIMESTAMP;
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_salida TIMESTAMP;
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_ubicacion_entrada TEXT;
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_ubicacion_salida TEXT;
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_lat_entrada DECIMAL(10, 7);
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_lng_entrada DECIMAL(10, 7);
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_lat_salida DECIMAL(10, 7);
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_lng_salida DECIMAL(10, 7);
ALTER TABLE overtime_tracking ADD COLUMN IF NOT EXISTS gps_data_uploaded BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN overtime_tracking.gps_entrada IS 'Hora GPS real de encendido del vehículo';
COMMENT ON COLUMN overtime_tracking.gps_salida IS 'Hora GPS real de apagado del vehículo';
COMMENT ON COLUMN overtime_tracking.gps_ubicacion_entrada IS 'Ubicación donde se encendió el vehículo';
COMMENT ON COLUMN overtime_tracking.gps_ubicacion_salida IS 'Ubicación donde se apagó el vehículo';

-- Función para analizar y detectar inicio/fin real del recorrido
CREATE OR REPLACE FUNCTION analyze_gps_route(p_overtime_id UUID)
RETURNS TABLE(
  entrada TIMESTAMP,
  salida TIMESTAMP,
  ubicacion_entrada TEXT,
  ubicacion_salida TEXT,
  lat_entrada DECIMAL,
  lng_entrada DECIMAL,
  lat_salida DECIMAL,
  lng_salida DECIMAL
) AS $$
DECLARE
  v_entrada_record RECORD;
  v_salida_record RECORD;
  v_prev_lat DECIMAL;
  v_prev_lng DECIMAL;
  v_prev_location TEXT;
  v_same_location_count INT;
BEGIN
  -- Detectar ENTRADA (Móvil Encendido + cambio de ubicación)
  -- Buscar primer "Movil Encendido" seguido de cambio de ubicación
  SELECT 
    g1.fecha_gps,
    g1.localizacion,
    g1.lat,
    g1.lng
  INTO v_entrada_record
  FROM gps_tracking g1
  WHERE g1.overtime_tracking_id = p_overtime_id
    AND g1.mensaje ILIKE '%Movil%Encendido%'
  ORDER BY g1.fecha_gps ASC
  LIMIT 1;
  
  -- Verificar si realmente se movió después de encender
  IF v_entrada_record IS NOT NULL THEN
    SELECT localizacion, lat, lng
    INTO v_prev_location, v_prev_lat, v_prev_lng
    FROM gps_tracking
    WHERE overtime_tracking_id = p_overtime_id
      AND fecha_gps > v_entrada_record.fecha_gps
      AND mensaje ILIKE '%Movil Encendido%'
      AND (
        ABS(lat - v_entrada_record.lat) > 0.001 OR 
        ABS(lng - v_entrada_record.lng) > 0.001
      )
    ORDER BY fecha_gps ASC
    LIMIT 1;
    
    -- Si no se movió en 20 minutos, buscar el siguiente encendido
    IF v_prev_location IS NULL THEN
      SELECT 
        g1.fecha_gps,
        g1.localizacion,
        g1.lat,
        g1.lng
      INTO v_entrada_record
      FROM gps_tracking g1
      WHERE g1.overtime_tracking_id = p_overtime_id
        AND g1.fecha_gps > v_entrada_record.fecha_gps + INTERVAL '20 minutes'
        AND g1.mensaje ILIKE '%Movil%Encendido%'
      ORDER BY g1.fecha_gps ASC
      LIMIT 1;
    END IF;
  END IF;
  
  -- Detectar SALIDA (Móvil Apagado + mismo lugar por >20 min)
  -- Buscar último "Movil Apagado" que se mantenga en el mismo lugar
  SELECT 
    g1.fecha_gps,
    g1.localizacion,
    g1.lat,
    g1.lng
  INTO v_salida_record
  FROM gps_tracking g1
  WHERE g1.overtime_tracking_id = p_overtime_id
    AND g1.mensaje ILIKE '%Movil%Apagado%'
    AND EXISTS (
      -- Verificar que se mantenga apagado en el mismo lugar por 20+ min
      SELECT 1
      FROM gps_tracking g2
      WHERE g2.overtime_tracking_id = p_overtime_id
        AND g2.fecha_gps BETWEEN g1.fecha_gps AND g1.fecha_gps + INTERVAL '20 minutes'
        AND g2.mensaje ILIKE '%Movil Apagado%'
        AND ABS(g2.lat - g1.lat) < 0.001
        AND ABS(g2.lng - g1.lng) < 0.001
      HAVING COUNT(*) >= 2
    )
  ORDER BY g1.fecha_gps DESC
  LIMIT 1;
  
  -- Retornar resultados
  entrada := v_entrada_record.fecha_gps;
  salida := v_salida_record.fecha_gps;
  ubicacion_entrada := v_entrada_record.localizacion;
  ubicacion_salida := v_salida_record.localizacion;
  lat_entrada := v_entrada_record.lat;
  lng_entrada := v_entrada_record.lng;
  lat_salida := v_salida_record.lat;
  lng_salida := v_salida_record.lng;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage all GPS tracking" ON gps_tracking;
CREATE POLICY "Admin can manage all GPS tracking"
ON gps_tracking
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'admin_logistics')
  )
);

DROP POLICY IF EXISTS "Users can view GPS tracking from their department" ON gps_tracking;
CREATE POLICY "Users can view GPS tracking from their department"
ON gps_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM overtime_tracking ot
    JOIN users u ON u.id = auth.uid()
    WHERE ot.id = gps_tracking.overtime_tracking_id
    AND ot.department = (
      CASE 
        WHEN u.role IN ('admin', 'user') THEN 'transport'
        WHEN u.role IN ('admin_logistics', 'logistics') THEN 'logistics'
      END
    )
  )
);

