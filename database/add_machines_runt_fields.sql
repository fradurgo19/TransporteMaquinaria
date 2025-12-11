-- ============================================
-- SCRIPT: Agregar campos adicionales del RUNT a la tabla machines
-- ============================================
-- Este script agrega nuevas columnas para almacenar información adicional
-- extraída de las imágenes del RUNT de las máquinas
-- ============================================

-- Agregar nuevas columnas si no existen
DO $$ 
BEGIN
    -- Número único de identificación
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'numero_identificacion') THEN
        ALTER TABLE public.machines 
        ADD COLUMN numero_identificacion VARCHAR(50);
    END IF;

    -- Nro. de identificación o serie del GPS de proveedor nacional
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'numero_serie_gps') THEN
        ALTER TABLE public.machines 
        ADD COLUMN numero_serie_gps VARCHAR(100);
    END IF;

    -- Nro. de IMEI del GPS de proveedor nacional
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'numero_imei_gps') THEN
        ALTER TABLE public.machines 
        ADD COLUMN numero_imei_gps VARCHAR(50);
    END IF;

    -- Clase (EXCAVADORA, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'clase') THEN
        ALTER TABLE public.machines 
        ADD COLUMN clase VARCHAR(100);
    END IF;

    -- Cilindraje
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'cilindraje') THEN
        ALTER TABLE public.machines 
        ADD COLUMN cilindraje INTEGER;
    END IF;

    -- Nro. motor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'numero_motor') THEN
        ALTER TABLE public.machines 
        ADD COLUMN numero_motor VARCHAR(100);
    END IF;

    -- Nro. chasis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'numero_chasis') THEN
        ALTER TABLE public.machines 
        ADD COLUMN numero_chasis VARCHAR(100);
    END IF;

    -- Subpartida arancelaria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'subpartida_arancelaria') THEN
        ALTER TABLE public.machines 
        ADD COLUMN subpartida_arancelaria VARCHAR(50);
    END IF;

    -- Rodaje (ORUGAS, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'rodaje') THEN
        ALTER TABLE public.machines 
        ADD COLUMN rodaje VARCHAR(50);
    END IF;

    -- Estado del vehículo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'estado_vehiculo') THEN
        ALTER TABLE public.machines 
        ADD COLUMN estado_vehiculo VARCHAR(50);
    END IF;

    -- Empresa de habilitación del Dispositivo GPS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'empresa_gps') THEN
        ALTER TABLE public.machines 
        ADD COLUMN empresa_gps VARCHAR(200);
    END IF;

    -- URL de la imagen del RUNT almacenada en Storage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'runt_image_url') THEN
        ALTER TABLE public.machines 
        ADD COLUMN runt_image_url TEXT;
    END IF;
END $$;

-- Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_machines_numero_identificacion ON public.machines(numero_identificacion);
CREATE INDEX IF NOT EXISTS idx_machines_numero_chasis ON public.machines(numero_chasis);
CREATE INDEX IF NOT EXISTS idx_machines_numero_motor ON public.machines(numero_motor);
CREATE INDEX IF NOT EXISTS idx_machines_clase ON public.machines(clase);

-- Comentarios en las columnas
COMMENT ON COLUMN public.machines.numero_identificacion IS 'Número único de identificación del RUNT';
COMMENT ON COLUMN public.machines.numero_serie_gps IS 'Nro. de identificación o serie del GPS de proveedor nacional';
COMMENT ON COLUMN public.machines.numero_imei_gps IS 'Nro. de IMEI del GPS de proveedor nacional';
COMMENT ON COLUMN public.machines.clase IS 'Clase del vehículo (EXCAVADORA, etc.)';
COMMENT ON COLUMN public.machines.cilindraje IS 'Cilindraje del motor';
COMMENT ON COLUMN public.machines.numero_motor IS 'Número del motor';
COMMENT ON COLUMN public.machines.numero_chasis IS 'Número del chasis';
COMMENT ON COLUMN public.machines.subpartida_arancelaria IS 'Subpartida arancelaria';
COMMENT ON COLUMN public.machines.rodaje IS 'Tipo de rodaje (ORUGAS, etc.)';
COMMENT ON COLUMN public.machines.estado_vehiculo IS 'Estado del vehículo (REGISTRADO, etc.)';
COMMENT ON COLUMN public.machines.empresa_gps IS 'Empresa de habilitación del Dispositivo GPS';
COMMENT ON COLUMN public.machines.runt_image_url IS 'URL de la imagen del RUNT almacenada en Supabase Storage';

