-- ============================================
-- TABLA PARA SEGUIMIENTO DE HORAS EXTRAS
-- ============================================

-- LIMPIAR PRIMERO (si existe)
DROP TRIGGER IF EXISTS calculate_overtime_trigger ON overtime_tracking;
DROP TRIGGER IF EXISTS overtime_tracking_updated_at ON overtime_tracking;
DROP FUNCTION IF EXISTS calculate_overtime();
DROP FUNCTION IF EXISTS update_overtime_tracking_updated_at();

DROP POLICY IF EXISTS "Admin transport can manage overtime tracking" ON overtime_tracking;
DROP POLICY IF EXISTS "Users can view own overtime tracking" ON overtime_tracking;
DROP POLICY IF EXISTS "Everyone can view festivos" ON festivos_colombia;
DROP POLICY IF EXISTS "Admin can manage festivos" ON festivos_colombia;

-- Tabla de festivos en Colombia
CREATE TABLE IF NOT EXISTS festivos_colombia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla principal de seguimiento de horas extras
CREATE TABLE IF NOT EXISTS overtime_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_hour_id UUID REFERENCES operation_hours(id) ON DELETE CASCADE,
  
  -- Datos base (desde operation_hours)
  placa VARCHAR(20) NOT NULL,
  conductor VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_salida TIME,
  
  -- Datos del GPS (importados desde Excel)
  hora_entrada_gps TIME,
  hora_salida_gps TIME,
  ubicacion_inicio TEXT,
  ubicacion_fin TEXT,
  kilometros_recorridos DECIMAL(10,2),
  
  -- Campos manuales del administrador
  ubicacion TEXT,
  actividad TEXT,
  
  -- Cálculos automáticos (se calculan con trigger o función)
  dia_semana VARCHAR(20),
  tipo_dia VARCHAR(20), -- 'Día Hábil' o 'Festivo'
  mes VARCHAR(20),
  validacion_entrada TIME,
  validacion_salida TIME,
  
  -- Horas calculadas (en decimal)
  he_diurna_decimal DECIMAL(10,6) DEFAULT 0,
  desayuno_almuerzo_decimal DECIMAL(10,6) DEFAULT 0,
  horario_compensado_decimal DECIMAL(10,6) DEFAULT 0,
  total_he_diurna_decimal DECIMAL(10,6) DEFAULT 0,
  he_nocturna_decimal DECIMAL(10,6) DEFAULT 0,
  dom_fest_decimal DECIMAL(10,6) DEFAULT 0,
  horas_finales_decimal DECIMAL(10,6) DEFAULT 0,
  
  -- Metadata
  department VARCHAR(50) DEFAULT 'transport',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_overtime_tracking_fecha ON overtime_tracking(fecha);
CREATE INDEX IF NOT EXISTS idx_overtime_tracking_placa ON overtime_tracking(placa);
CREATE INDEX IF NOT EXISTS idx_overtime_tracking_operation ON overtime_tracking(operation_hour_id);
CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON festivos_colombia(fecha);

-- Función para calcular horas extras automáticamente
CREATE OR REPLACE FUNCTION calculate_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_dia_semana TEXT;
  v_tipo_dia TEXT;
  v_mes TEXT;
  v_es_festivo BOOLEAN;
  v_hora_entrada_decimal DECIMAL;
  v_hora_salida_decimal DECIMAL;
  v_validacion_entrada_decimal DECIMAL;
  v_validacion_salida_decimal DECIMAL;
  v_he_diurna DECIMAL;
  v_desayuno_almuerzo DECIMAL;
  v_horario_compensado DECIMAL;
  v_he_nocturna DECIMAL;
  v_dom_fest DECIMAL;
BEGIN
  -- Obtener día de la semana y mes
  v_dia_semana := INITCAP(TO_CHAR(NEW.fecha, 'Day'));
  v_mes := INITCAP(TO_CHAR(NEW.fecha, 'Month'));
  
  -- Verificar si es festivo o domingo
  v_es_festivo := (v_dia_semana = 'Sunday' OR EXISTS (
    SELECT 1 FROM festivos_colombia WHERE fecha = NEW.fecha
  ));
  
  v_tipo_dia := CASE WHEN v_es_festivo THEN 'Festivo' ELSE 'Día Hábil' END;
  
  -- Actualizar campos calculados básicos
  NEW.dia_semana := v_dia_semana;
  NEW.tipo_dia := v_tipo_dia;
  NEW.mes := v_mes;
  
  -- Convertir horas a decimal (7:00 = 0.291667)
  v_hora_entrada_decimal := EXTRACT(HOUR FROM NEW.hora_entrada)::DECIMAL / 24 + 
                            EXTRACT(MINUTE FROM NEW.hora_entrada)::DECIMAL / 1440;
  
  IF NEW.hora_salida IS NOT NULL THEN
    v_hora_salida_decimal := EXTRACT(HOUR FROM NEW.hora_salida)::DECIMAL / 24 + 
                             EXTRACT(MINUTE FROM NEW.hora_salida)::DECIMAL / 1440;
  ELSE
    v_hora_salida_decimal := NULL;
  END IF;
  
  -- Validaciones de entrada/salida según día
  -- Lunes-Jueves: 8:00 AM - 5:30 PM
  -- Viernes: 8:00 AM - 4:00 PM
  -- Sábado: 9:00 AM - 12:00 PM
  
  IF v_dia_semana IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday') THEN
    v_validacion_entrada_decimal := 8.0 / 24;    -- 8:00 AM = 0.333333
    v_validacion_salida_decimal := 17.5 / 24;    -- 5:30 PM = 0.729167
    NEW.validacion_entrada := '08:00:00';
    NEW.validacion_salida := '17:30:00';
  ELSIF v_dia_semana = 'Friday' THEN
    v_validacion_entrada_decimal := 8.0 / 24;    -- 8:00 AM = 0.333333
    v_validacion_salida_decimal := 16.0 / 24;    -- 4:00 PM = 0.666667
    NEW.validacion_entrada := '08:00:00';
    NEW.validacion_salida := '16:00:00';
  ELSIF v_dia_semana = 'Saturday' THEN
    v_validacion_entrada_decimal := 9.0 / 24;    -- 9:00 AM = 0.375
    v_validacion_salida_decimal := 12.0 / 24;    -- 12:00 PM = 0.5
    NEW.validacion_entrada := '09:00:00';
    NEW.validacion_salida := '12:00:00';
  ELSE -- Domingo
    v_validacion_entrada_decimal := 8.0 / 24;
    v_validacion_salida_decimal := 17.5 / 24;
    NEW.validacion_entrada := '08:00:00';
    NEW.validacion_salida := '17:30:00';
  END IF;
  
  -- Solo calcular si hay hora de salida
  IF v_hora_salida_decimal IS NOT NULL THEN
    -- H.E. Diurna
    -- Lunes-Viernes: 5:30 PM - 9:00 PM y 6:00 AM - 8:00 AM
    -- Sábado: 6:00 AM - 9:00 AM y 12:00 PM - 9:00 PM
    IF v_es_festivo THEN
      v_he_diurna := 0;
    ELSIF v_dia_semana = 'Saturday' THEN
      -- Sábado: 6:00 AM - 9:00 AM (0.25 - 0.375) y 12:00 PM - 9:00 PM (0.5 - 0.875)
      v_he_diurna := GREATEST(0, LEAST(0.375, v_hora_entrada_decimal) - 0.25) +  -- Antes de 9 AM
                     GREATEST(0, 0.375 - GREATEST(0.25, v_hora_entrada_decimal)) +  -- Si entró antes de 9 AM
                     GREATEST(0, LEAST(0.875, v_hora_salida_decimal) - 0.5);  -- Después de 12 PM
    ELSE
      -- Lunes-Viernes: 6:00 AM - 8:00 AM (0.25 - 0.333333) y 5:30 PM - 9:00 PM (0.729167 - 0.875)
      v_he_diurna := GREATEST(0, 0.333333 - GREATEST(0.25, v_hora_entrada_decimal)) +  -- Antes de 8 AM
                     GREATEST(0, LEAST(0.875, v_hora_salida_decimal) - v_validacion_salida_decimal);  -- Después de 5:30 PM
    END IF;
    
    -- Desayuno/Almuerzo
    -- 7:00 AM = 7/24 = 0.291667, 2:00 PM = 14/24 = 0.583333
    IF v_es_festivo OR v_dia_semana = 'Sunday' THEN
      -- Festivos/Domingos: entrada antes 7am Y salida después 2pm = 2h, sino entrada antes 7am = 1h
      IF v_hora_entrada_decimal < 0.291667 AND v_hora_salida_decimal >= 0.583333 THEN
        v_desayuno_almuerzo := 2.0 / 24; -- 2 horas
      ELSIF v_hora_entrada_decimal < 0.291667 THEN
        v_desayuno_almuerzo := 1.0 / 24; -- 1 hora
      ELSE
        v_desayuno_almuerzo := 0;
      END IF;
    ELSIF v_dia_semana = 'Saturday' THEN
      -- Sábado: entrada antes 7am Y salida después 2pm = 2h, sino entrada antes 7am = 1h
      IF v_hora_entrada_decimal < 0.291667 AND v_hora_salida_decimal >= 0.583333 THEN
        v_desayuno_almuerzo := 2.0 / 24;
      ELSIF v_hora_entrada_decimal < 0.291667 THEN
        v_desayuno_almuerzo := 1.0 / 24;
      ELSE
        v_desayuno_almuerzo := 0;
      END IF;
    ELSE -- Lunes-Viernes
      -- Entrada antes de 7am = 1h
      IF v_hora_entrada_decimal < 0.291667 THEN
        v_desayuno_almuerzo := 1.0 / 24;
      ELSE
        v_desayuno_almuerzo := 0;
      END IF;
    END IF;
    
    -- Horario compensado (llegadas tarde o salidas tempranas)
    IF v_es_festivo THEN
      v_horario_compensado := 0;
    ELSE
      v_horario_compensado := GREATEST(0, v_hora_entrada_decimal - v_validacion_entrada_decimal) +
                              GREATEST(0, v_validacion_salida_decimal - v_hora_salida_decimal);
    END IF;
    
    -- Total H.E. Diurna
    NEW.he_diurna_decimal := v_he_diurna;
    NEW.desayuno_almuerzo_decimal := v_desayuno_almuerzo;
    NEW.horario_compensado_decimal := v_horario_compensado;
    NEW.total_he_diurna_decimal := v_he_diurna - v_desayuno_almuerzo - v_horario_compensado;
    
    -- H.E. Nocturna (9:00 PM - 6:00 AM) con multiplicador 1.35
    -- 9:00 PM = 21/24 = 0.875, 6:00 AM = 0.25
    IF v_es_festivo THEN
      v_he_nocturna := 0;
    ELSE
      -- Horas de 9 PM (0.875) hasta medianoche + medianoche hasta 6 AM (0.25)
      v_he_nocturna := (
        GREATEST(0, LEAST(v_hora_salida_decimal, 1) - GREATEST(v_hora_entrada_decimal, 0.875)) +  -- 9 PM - 12 AM
        GREATEST(0, LEAST(v_hora_salida_decimal, 0.25) - GREATEST(v_hora_entrada_decimal, 0))     -- 12 AM - 6 AM
      ) * 1.35;
    END IF;
    NEW.he_nocturna_decimal := v_he_nocturna;
    
    -- Dom/Fest con multiplicador 1.75
    -- (Horas trabajadas - Alimentación) * 1.75
    IF v_es_festivo OR v_dia_semana = 'Sunday' THEN
      DECLARE
        v_horas_trabajadas DECIMAL;
      BEGIN
        v_horas_trabajadas := v_hora_salida_decimal - v_hora_entrada_decimal;
        -- Si pasa medianoche, ajustar
        IF v_hora_salida_decimal < v_hora_entrada_decimal THEN
          v_horas_trabajadas := (1 - v_hora_entrada_decimal) + v_hora_salida_decimal;
        END IF;
        v_dom_fest := (v_horas_trabajadas - v_desayuno_almuerzo) * 1.75;
      END;
    ELSE
      v_dom_fest := 0;
    END IF;
    NEW.dom_fest_decimal := GREATEST(0, v_dom_fest);
    
    -- Horas Finales (suma de todo)
    NEW.horas_finales_decimal := NEW.total_he_diurna_decimal + NEW.he_nocturna_decimal + NEW.dom_fest_decimal;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular automáticamente
CREATE TRIGGER calculate_overtime_trigger
BEFORE INSERT OR UPDATE ON overtime_tracking
FOR EACH ROW
EXECUTE FUNCTION calculate_overtime();

-- Función para updated_at
CREATE OR REPLACE FUNCTION update_overtime_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER overtime_tracking_updated_at
BEFORE UPDATE ON overtime_tracking
FOR EACH ROW
EXECUTE FUNCTION update_overtime_tracking_updated_at();

-- RLS Policies
ALTER TABLE overtime_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivos_colombia ENABLE ROW LEVEL SECURITY;

-- Admin de transport puede ver y gestionar todo de transport
CREATE POLICY "Admin transport can manage overtime tracking"
ON overtime_tracking
FOR ALL
TO authenticated
USING (
  department = 'transport' AND
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Usuarios pueden ver sus propios registros
CREATE POLICY "Users can view own overtime tracking"
ON overtime_tracking
FOR SELECT
TO authenticated
USING (
  department = 'transport' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'user')
  )
);

-- Todos pueden ver festivos
CREATE POLICY "Everyone can view festivos"
ON festivos_colombia
FOR SELECT
TO authenticated
USING (true);

-- Admin puede gestionar festivos
CREATE POLICY "Admin can manage festivos"
ON festivos_colombia
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Insertar festivos de Colombia 2025-2028
INSERT INTO festivos_colombia (fecha, nombre) VALUES
-- 2025
('2025-01-01', 'Año Nuevo'),
('2025-01-06', 'Reyes Magos'),
('2025-03-24', 'San José'),
('2025-04-17', 'Jueves Santo'),
('2025-04-18', 'Viernes Santo'),
('2025-05-01', 'Día del Trabajo'),
('2025-05-19', 'Ascensión del Señor'),
('2025-06-09', 'Corpus Christi'),
('2025-06-16', 'Sagrado Corazón'),
('2025-06-23', 'San Pedro y San Pablo'),
('2025-07-20', 'Día de la Independencia'),
('2025-08-07', 'Batalla de Boyacá'),
('2025-08-18', 'Asunción de la Virgen'),
('2025-10-13', 'Día de la Raza'),
('2025-11-03', 'Todos los Santos'),
('2025-11-17', 'Independencia de Cartagena'),
('2025-12-08', 'Inmaculada Concepción'),
('2025-12-25', 'Navidad'),
-- 2026
('2026-01-01', 'Año Nuevo'),
('2026-01-12', 'Reyes Magos'),
('2026-03-23', 'San José'),
('2026-04-02', 'Jueves Santo'),
('2026-04-03', 'Viernes Santo'),
('2026-05-01', 'Día del Trabajo'),
('2026-05-18', 'Ascensión del Señor'),
('2026-06-08', 'Corpus Christi'),
('2026-06-15', 'Sagrado Corazón'),
('2026-06-29', 'San Pedro y San Pablo'),
('2026-07-20', 'Día de la Independencia'),
('2026-08-07', 'Batalla de Boyacá'),
('2026-08-17', 'Asunción de la Virgen'),
('2026-10-12', 'Día de la Raza'),
('2026-11-02', 'Todos los Santos'),
('2026-11-16', 'Independencia de Cartagena'),
('2026-12-08', 'Inmaculada Concepción'),
('2026-12-25', 'Navidad'),
-- 2027
('2027-01-01', 'Año Nuevo'),
('2027-01-11', 'Reyes Magos'),
('2027-03-22', 'San José'),
('2027-03-25', 'Jueves Santo'),
('2027-03-26', 'Viernes Santo'),
('2027-05-01', 'Día del Trabajo'),
('2027-05-10', 'Ascensión del Señor'),
('2027-05-31', 'Corpus Christi'),
('2027-06-07', 'Sagrado Corazón'),
('2027-06-28', 'San Pedro y San Pablo'),
('2027-07-20', 'Día de la Independencia'),
('2027-08-07', 'Batalla de Boyacá'),
('2027-08-16', 'Asunción de la Virgen'),
('2027-10-18', 'Día de la Raza'),
('2027-11-01', 'Todos los Santos'),
('2027-11-15', 'Independencia de Cartagena'),
('2027-12-08', 'Inmaculada Concepción'),
('2027-12-25', 'Navidad'),
-- 2028
('2028-01-01', 'Año Nuevo'),
('2028-01-10', 'Reyes Magos'),
('2028-03-20', 'San José'),
('2028-04-13', 'Jueves Santo'),
('2028-04-14', 'Viernes Santo'),
('2028-05-01', 'Día del Trabajo'),
('2028-05-29', 'Ascensión del Señor'),
('2028-06-19', 'Corpus Christi'),
('2028-06-26', 'Sagrado Corazón'),
('2028-07-03', 'San Pedro y San Pablo'),
('2028-07-20', 'Día de la Independencia'),
('2028-08-07', 'Batalla de Boyacá'),
('2028-08-21', 'Asunción de la Virgen'),
('2028-10-16', 'Día de la Raza'),
('2028-11-06', 'Todos los Santos'),
('2028-11-13', 'Independencia de Cartagena'),
('2028-12-08', 'Inmaculada Concepción'),
('2028-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

COMMENT ON TABLE overtime_tracking IS 'Seguimiento detallado de horas extras con cálculos automáticos';
COMMENT ON TABLE festivos_colombia IS 'Días festivos en Colombia para cálculos de horas extras';

