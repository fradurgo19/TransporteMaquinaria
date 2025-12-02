-- ============================================
-- TABLA PARA SEGUIMIENTO DE HORAS EXTRAS
-- ============================================

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
  -- Lunes-Jueves: entrada 7:00 (0.291667), salida 17:00 (0.708333)
  -- Viernes: entrada 7:00 (0.291667), salida 16:00 (0.666667)
  -- Sábado: entrada 7:00 (0.291667), salida 13:00 (0.541667)
  
  IF v_dia_semana IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday') THEN
    v_validacion_entrada_decimal := 0.291667; -- 7:00
    v_validacion_salida_decimal := 0.708333;  -- 17:00
    NEW.validacion_entrada := '07:00:00';
    NEW.validacion_salida := '17:00:00';
  ELSIF v_dia_semana = 'Friday' THEN
    v_validacion_entrada_decimal := 0.291667; -- 7:00
    v_validacion_salida_decimal := 0.666667;  -- 16:00
    NEW.validacion_entrada := '07:00:00';
    NEW.validacion_salida := '16:00:00';
  ELSIF v_dia_semana = 'Saturday' THEN
    v_validacion_entrada_decimal := 0.291667; -- 7:00
    v_validacion_salida_decimal := 0.541667;  -- 13:00
    NEW.validacion_entrada := '07:00:00';
    NEW.validacion_salida := '13:00:00';
  ELSE -- Domingo
    v_validacion_entrada_decimal := 0.291667;
    v_validacion_salida_decimal := 0.708333;
    NEW.validacion_entrada := '07:00:00';
    NEW.validacion_salida := '17:00:00';
  END IF;
  
  -- Solo calcular si hay hora de salida
  IF v_hora_salida_decimal IS NOT NULL THEN
    -- H.E. Diurna (entre 6:00 y 21:00)
    IF v_es_festivo THEN
      v_he_diurna := 0;
    ELSE
      v_he_diurna := GREATEST(0, LEAST(0.875, v_hora_salida_decimal) - GREATEST(0.25, v_validacion_salida_decimal)) +
                     GREATEST(0, LEAST(0.875, v_validacion_entrada_decimal) - GREATEST(0.25, v_hora_entrada_decimal));
    END IF;
    
    -- Desayuno/Almuerzo (1h o 2h según horario)
    IF v_es_festivo OR v_dia_semana = 'Sunday' THEN
      IF v_hora_entrada_decimal < 0.5 AND v_hora_salida_decimal >= 0.583333 THEN
        v_desayuno_almuerzo := 2.0 / 24; -- 2 horas
      ELSIF v_hora_entrada_decimal < 0.5 THEN
        v_desayuno_almuerzo := 1.0 / 24; -- 1 hora
      ELSE
        v_desayuno_almuerzo := 0;
      END IF;
    ELSIF v_dia_semana = 'Saturday' THEN
      IF v_hora_entrada_decimal <= 0.270833 AND v_hora_salida_decimal >= 0.583333 THEN
        v_desayuno_almuerzo := 2.0 / 24;
      ELSIF v_hora_entrada_decimal <= 0.270833 THEN
        v_desayuno_almuerzo := 1.0 / 24;
      ELSE
        v_desayuno_almuerzo := 0;
      END IF;
    ELSE -- Lunes-Viernes
      IF v_hora_entrada_decimal <= 0.270833 THEN
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
    
    -- H.E. Nocturna (21:00-6:00) con multiplicador 1.35
    IF v_es_festivo THEN
      v_he_nocturna := 0;
    ELSE
      v_he_nocturna := (GREATEST(0, LEAST(v_hora_salida_decimal, 0.25) - GREATEST(v_hora_entrada_decimal, 0)) +
                        GREATEST(0, LEAST(v_hora_salida_decimal, 1) - GREATEST(v_hora_entrada_decimal, 0.875))) * 1.35;
    END IF;
    NEW.he_nocturna_decimal := v_he_nocturna;
    
    -- Dom/Fest con multiplicador 1.75
    IF v_es_festivo THEN
      v_dom_fest := (LEAST(v_hora_salida_decimal, 0.5) - v_hora_entrada_decimal +
                     GREATEST(0, v_hora_salida_decimal - 0.5)) * 1.75;
    ELSE
      v_dom_fest := 0;
    END IF;
    NEW.dom_fest_decimal := v_dom_fest;
    
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

-- Trigger para updated_at
CREATE TRIGGER overtime_tracking_updated_at
BEFORE UPDATE ON overtime_tracking
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

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

-- Insertar festivos de Colombia 2025
INSERT INTO festivos_colombia (fecha, nombre) VALUES
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
('2025-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

COMMENT ON TABLE overtime_tracking IS 'Seguimiento detallado de horas extras con cálculos automáticos';
COMMENT ON TABLE festivos_colombia IS 'Días festivos en Colombia para cálculos de horas extras';

