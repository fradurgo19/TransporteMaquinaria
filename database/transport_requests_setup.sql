-- ============================================
-- TABLAS PARA SOLICITUDES DE TRANSPORTE
-- ============================================

-- Tabla de máquinas/equipos (base de datos de máquinas)
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serie VARCHAR(100),
  descripcion TEXT,
  marca VARCHAR(100),
  modelo VARCHAR(100),
  ancho DECIMAL(10, 2),
  alto DECIMAL(10, 2),
  largo DECIMAL(10, 2),
  peso DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Añadir columnas si no existen y constraints necesarios
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'serie') THEN
    ALTER TABLE machines ADD COLUMN serie VARCHAR(100);
  END IF;
  -- Añadir constraint unique si no existe (después de asegurar que la columna existe)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'serie') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'machines_serie_unique' 
      AND table_name = 'machines'
    ) THEN
      ALTER TABLE machines ADD CONSTRAINT machines_serie_unique UNIQUE(serie);
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'descripcion') THEN
    ALTER TABLE machines ADD COLUMN descripcion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'marca') THEN
    ALTER TABLE machines ADD COLUMN marca VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'modelo') THEN
    ALTER TABLE machines ADD COLUMN modelo VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'ancho') THEN
    ALTER TABLE machines ADD COLUMN ancho DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'alto') THEN
    ALTER TABLE machines ADD COLUMN alto DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'largo') THEN
    ALTER TABLE machines ADD COLUMN largo DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'peso') THEN
    ALTER TABLE machines ADD COLUMN peso DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'created_by') THEN
    ALTER TABLE machines ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
END $$;

-- Crear índices solo si las columnas existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'serie') THEN
    CREATE INDEX IF NOT EXISTS idx_machines_serie ON machines(serie);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'marca') THEN
    CREATE INDEX IF NOT EXISTS idx_machines_marca ON machines(marca);
  END IF;
END $$;

-- Comentarios (después de asegurar que las columnas existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machines') THEN
    COMMENT ON TABLE machines IS 'Base de datos de máquinas/equipos para transporte';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'serie') THEN
      COMMENT ON COLUMN machines.serie IS 'Número de serie único del equipo';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'descripcion') THEN
      COMMENT ON COLUMN machines.descripcion IS 'Descripción del equipo';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'peso') THEN
      COMMENT ON COLUMN machines.peso IS 'Peso en kilogramos';
    END IF;
  END IF;
END $$;

-- Tabla de solicitudes de transporte
CREATE TABLE IF NOT EXISTS transport_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID REFERENCES machines(id) ON DELETE RESTRICT,
  
  -- Datos de la máquina (copiados al momento de crear la solicitud)
  serie VARCHAR(100),
  descripcion TEXT,
  marca VARCHAR(100),
  modelo VARCHAR(100),
  ancho DECIMAL(10, 2),
  alto DECIMAL(10, 2),
  largo DECIMAL(10, 2),
  peso DECIMAL(10, 2),
  
  -- Datos de envío
  nombre_destinatario VARCHAR(255),
  direccion TEXT,
  celular VARCHAR(20),
  ciudad VARCHAR(100),
  
  -- Datos de cargue
  origen_cargue TEXT,
  
  -- Otros datos
  fecha_entrega DATE,
  persona_entrega VARCHAR(255),
  vb_ingeniero BOOLEAN DEFAULT false,
  vb_ingeniero_nombre VARCHAR(255),
  vb_ingeniero_fecha TIMESTAMP WITH TIME ZONE,
  
  -- Estado y control
  status VARCHAR(20) DEFAULT 'pending',
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Añadir constraint de status si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'transport_requests' 
    AND constraint_name LIKE '%status%'
  ) THEN
    ALTER TABLE transport_requests 
    ADD CONSTRAINT transport_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

-- Añadir columnas si no existen (para migraciones)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'serie') THEN
    ALTER TABLE transport_requests ADD COLUMN serie VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'machine_id') THEN
    ALTER TABLE transport_requests ADD COLUMN machine_id UUID REFERENCES machines(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'descripcion') THEN
    ALTER TABLE transport_requests ADD COLUMN descripcion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'marca') THEN
    ALTER TABLE transport_requests ADD COLUMN marca VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'modelo') THEN
    ALTER TABLE transport_requests ADD COLUMN modelo VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'ancho') THEN
    ALTER TABLE transport_requests ADD COLUMN ancho DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'alto') THEN
    ALTER TABLE transport_requests ADD COLUMN alto DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'largo') THEN
    ALTER TABLE transport_requests ADD COLUMN largo DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'peso') THEN
    ALTER TABLE transport_requests ADD COLUMN peso DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'nombre_destinatario') THEN
    ALTER TABLE transport_requests ADD COLUMN nombre_destinatario VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'direccion') THEN
    ALTER TABLE transport_requests ADD COLUMN direccion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'celular') THEN
    ALTER TABLE transport_requests ADD COLUMN celular VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'ciudad') THEN
    ALTER TABLE transport_requests ADD COLUMN ciudad VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'origen_cargue') THEN
    ALTER TABLE transport_requests ADD COLUMN origen_cargue TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'fecha_entrega') THEN
    ALTER TABLE transport_requests ADD COLUMN fecha_entrega DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'persona_entrega') THEN
    ALTER TABLE transport_requests ADD COLUMN persona_entrega VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'vb_ingeniero') THEN
    ALTER TABLE transport_requests ADD COLUMN vb_ingeniero BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'vb_ingeniero_nombre') THEN
    ALTER TABLE transport_requests ADD COLUMN vb_ingeniero_nombre VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'vb_ingeniero_fecha') THEN
    ALTER TABLE transport_requests ADD COLUMN vb_ingeniero_fecha TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'requested_by') THEN
    ALTER TABLE transport_requests ADD COLUMN requested_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'notes') THEN
    ALTER TABLE transport_requests ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Hacer columnas antiguas opcionales si existen (para compatibilidad)
-- Esto evita errores si las columnas antiguas tienen NOT NULL

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'serial_number') THEN
    ALTER TABLE transport_requests ALTER COLUMN serial_number DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'brand') THEN
    ALTER TABLE transport_requests ALTER COLUMN brand DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'model') THEN
    ALTER TABLE transport_requests ALTER COLUMN model DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'weight') THEN
    ALTER TABLE transport_requests ALTER COLUMN weight DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'length') THEN
    ALTER TABLE transport_requests ALTER COLUMN length DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'origin') THEN
    ALTER TABLE transport_requests ALTER COLUMN origin DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'destination') THEN
    ALTER TABLE transport_requests ALTER COLUMN destination DROP NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'requested_date') THEN
    ALTER TABLE transport_requests ALTER COLUMN requested_date DROP NOT NULL;
  END IF;
END $$;

-- Crear índices solo si las columnas existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_transport_requests_status ON transport_requests(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'requested_by') THEN
    CREATE INDEX IF NOT EXISTS idx_transport_requests_requested_by ON transport_requests(requested_by);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'serie') THEN
    CREATE INDEX IF NOT EXISTS idx_transport_requests_serie ON transport_requests(serie);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_transport_requests_created_at ON transport_requests(created_at);
  END IF;
END $$;

-- Comentarios (después de asegurar que las columnas existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_requests') THEN
    COMMENT ON TABLE transport_requests IS 'Solicitudes de transporte de equipos';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'status') THEN
      COMMENT ON COLUMN transport_requests.status IS 'Estado de la solicitud: pending, approved, in_progress, completed, cancelled';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transport_requests' AND column_name = 'vb_ingeniero') THEN
      COMMENT ON COLUMN transport_requests.vb_ingeniero IS 'Visto bueno del ingeniero';
    END IF;
  END IF;
END $$;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_machines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS machines_updated_at ON machines;
CREATE TRIGGER machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW
  EXECUTE FUNCTION update_machines_updated_at();

CREATE OR REPLACE FUNCTION update_transport_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transport_requests_updated_at ON transport_requests;
CREATE TRIGGER transport_requests_updated_at
  BEFORE UPDATE ON transport_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_requests_updated_at();

-- RLS Policies
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_requests ENABLE ROW LEVEL SECURITY;

-- Máquinas: todos pueden ver, solo admins pueden crear/editar
DROP POLICY IF EXISTS "Anyone can view machines" ON machines;
CREATE POLICY "Anyone can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert machines" ON machines;
CREATE POLICY "Admins can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can update machines" ON machines;
CREATE POLICY "Admins can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Admins can delete machines" ON machines;
CREATE POLICY "Admins can delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

-- Solicitudes: comerciales pueden crear y ver las suyas, admins ven todas
DROP POLICY IF EXISTS "Users can view their own requests" ON transport_requests;
CREATE POLICY "Users can view their own requests"
  ON transport_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

DROP POLICY IF EXISTS "Commercial users can create requests" ON transport_requests;
CREATE POLICY "Commercial users can create requests"
  ON transport_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('commercial', 'admin', 'admin_logistics')
    )
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update requests" ON transport_requests;
CREATE POLICY "Admins can update requests"
  ON transport_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

