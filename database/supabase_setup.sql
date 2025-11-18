-- ============================================
-- SETUP COMPLETO PARA SUPABASE
-- Sistema de Gestión de Transporte
-- Autor: Frank Anderson Duran Gonzalez
-- Fecha: Noviembre 2025
-- ============================================
-- 
-- INSTRUCCIONES:
-- 1. Crear proyecto en Supabase
-- 2. Ir a SQL Editor
-- 3. Ejecutar este script completo
-- 4. Configurar políticas RLS según necesidad
-- ============================================

-- ============================================
-- EXTENSIONES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA: users (sincronizada con auth.users)
-- ============================================
-- NOTA: Supabase maneja autenticación en auth.users
-- Esta tabla almacena el perfil extendido del usuario
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user', 'commercial', 'guest')),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: equipment
-- ============================================
CREATE TABLE public.equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_name VARCHAR(255) NOT NULL,
    site_location VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    license_plate VARCHAR(50) UNIQUE NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('tractor', 'trailer')),
    
    -- Fechas de vencimiento
    technical_inspection_expiration DATE NOT NULL,
    soat_expiration DATE NOT NULL,
    insurance_policy_expiration DATE NOT NULL,
    driver_license_expiration DATE NOT NULL,
    
    permit_status VARCHAR(50) NOT NULL,
    
    -- GPS última ubicación conocida
    last_gps_latitude DECIMAL(10, 8),
    last_gps_longitude DECIMAL(11, 8),
    last_gps_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- Odómetro
    current_odometer INTEGER DEFAULT 0,
    
    -- Estado del vehículo
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'retired')),
    
    -- Notas adicionales
    notes TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: equipment_documents
-- ============================================
CREATE TABLE public.equipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES public.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operation_hours
-- ============================================
CREATE TABLE public.operation_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES public.equipment(license_plate),
    driver_name VARCHAR(255) NOT NULL,
    
    -- Tiempos
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    
    -- Descripción de la tarea
    task_description TEXT NOT NULL,
    
    -- Ubicación GPS
    location_latitude DECIMAL(10, 8) NOT NULL,
    location_longitude DECIMAL(11, 8) NOT NULL,
    
    -- Tipo de actividad
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('regular', 'overtime', 'night', 'holiday')),
    
    -- Cálculos de horas (se calculan automáticamente)
    total_hours DECIMAL(5, 2),
    regular_hours DECIMAL(5, 2),
    overtime_hours DECIMAL(5, 2),
    night_hours DECIMAL(5, 2),
    holiday_hours DECIMAL(5, 2),
    breakfast_deduction DECIMAL(3, 2) DEFAULT 0,
    lunch_deduction DECIMAL(3, 2) DEFAULT 0,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    
    -- Auditoría
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: fuel_logs
-- ============================================
CREATE TABLE public.fuel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES public.equipment(license_plate),
    
    -- Datos del combustible
    fuel_date DATE NOT NULL,
    gallons DECIMAL(8, 2) NOT NULL CHECK (gallons > 0),
    cost DECIMAL(12, 2) NOT NULL CHECK (cost > 0),
    
    -- Odómetro
    starting_odometer INTEGER NOT NULL,
    ending_odometer INTEGER NOT NULL,
    distance_traveled INTEGER GENERATED ALWAYS AS (ending_odometer - starting_odometer) STORED,
    
    -- Eficiencia (km por galón)
    fuel_efficiency DECIMAL(6, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN gallons > 0 THEN (ending_odometer - starting_odometer)::DECIMAL / gallons
            ELSE 0
        END
    ) STORED,
    
    -- Foto del recibo
    receipt_photo_path VARCHAR(500),
    
    -- Ubicación GPS
    gps_latitude DECIMAL(10, 8) NOT NULL,
    gps_longitude DECIMAL(11, 8) NOT NULL,
    
    -- Estación de servicio
    gas_station_name VARCHAR(255),
    
    -- Auditoría
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operations
-- ============================================
CREATE TABLE public.operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES public.equipment(license_plate),
    driver_name VARCHAR(255) NOT NULL,
    
    -- Tiempo y tipo
    operation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('loading', 'route_start', 'delivery')),
    
    -- Ubicación GPS
    gps_latitude DECIMAL(10, 8) NOT NULL,
    gps_longitude DECIMAL(11, 8) NOT NULL,
    
    -- Información de la carga
    cargo_description TEXT,
    cargo_weight DECIMAL(10, 2),
    
    -- Ubicaciones
    origin VARCHAR(255),
    destination VARCHAR(255),
    
    -- Notas adicionales
    notes TEXT,
    
    -- Estado
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'in_progress')),
    
    -- Auditoría
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operation_photos
-- ============================================
CREATE TABLE public.operation_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
    photo_path VARCHAR(500) NOT NULL,
    photo_description VARCHAR(255),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: pre_operational_checklists
-- ============================================
CREATE TABLE public.pre_operational_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES public.equipment(license_plate),
    driver_name VARCHAR(255) NOT NULL,
    
    -- Fecha y hora de inspección
    check_date DATE NOT NULL,
    check_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Items de inspección
    tire_condition VARCHAR(20) CHECK (tire_condition IN ('good', 'fair', 'poor', 'critical')),
    brake_condition VARCHAR(20) CHECK (brake_condition IN ('good', 'fair', 'poor', 'critical')),
    lights_condition VARCHAR(20) CHECK (lights_condition IN ('good', 'fair', 'poor', 'critical')),
    fluid_levels VARCHAR(20) CHECK (fluid_levels IN ('good', 'fair', 'poor', 'critical')),
    engine_condition VARCHAR(20) CHECK (engine_condition IN ('good', 'fair', 'poor', 'critical')),
    
    -- Evaluación general
    vehicle_condition_assessment TEXT NOT NULL,
    
    -- Foto de condición
    condition_photo_path VARCHAR(500),
    
    -- Problemas detectados
    issues_found TEXT[],
    
    -- ¿Pasó la inspección?
    passed BOOLEAN NOT NULL,
    
    -- Si no pasó, razón
    failure_reason TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: transport_requests
-- ============================================
CREATE TABLE public.transport_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Información del equipo a transportar
    serial_number VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    weight DECIMAL(10, 2) NOT NULL CHECK (weight > 0),
    length DECIMAL(8, 2) NOT NULL CHECK (length > 0),
    capacity DECIMAL(10, 2),
    
    -- Ubicaciones
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    
    -- Estado de la solicitud
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
    
    -- Asignación
    assigned_vehicle VARCHAR(50) REFERENCES public.equipment(license_plate),
    assigned_driver VARCHAR(255),
    
    -- Fechas
    requested_date DATE NOT NULL,
    preferred_pickup_date DATE,
    actual_pickup_date DATE,
    actual_delivery_date DATE,
    
    -- Prioridad
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Notas y razones
    notes TEXT,
    rejection_reason TEXT,
    
    -- Costos
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    
    -- Auditoría
    requested_by UUID NOT NULL REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: expense_claims
-- ============================================
CREATE TABLE public.expense_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES public.equipment(license_plate),
    expense_date DATE NOT NULL,
    expense_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    receipt_photo_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: holidays
-- ============================================
CREATE TABLE public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date DATE UNIQUE NOT NULL,
    holiday_name VARCHAR(255) NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: system_alerts
-- ============================================
CREATE TABLE public.system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'error', 'info', 'success')),
    message TEXT NOT NULL,
    
    -- Relacionado a
    equipment_id UUID REFERENCES public.equipment(id),
    user_id UUID REFERENCES public.users(id),
    
    -- Estado
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLA: audit_logs
-- ============================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES public.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_role ON public.users(role);

-- Equipment
CREATE INDEX idx_equipment_license_plate ON public.equipment(license_plate);
CREATE INDEX idx_equipment_status ON public.equipment(status);
CREATE INDEX idx_equipment_driver ON public.equipment(driver_name);
CREATE INDEX idx_equipment_expirations ON public.equipment(technical_inspection_expiration, soat_expiration, insurance_policy_expiration, driver_license_expiration);

-- Operation Hours
CREATE INDEX idx_operation_hours_vehicle ON public.operation_hours(vehicle_plate);
CREATE INDEX idx_operation_hours_driver ON public.operation_hours(driver_name);
CREATE INDEX idx_operation_hours_dates ON public.operation_hours(check_in_time, check_out_time);
CREATE INDEX idx_operation_hours_status ON public.operation_hours(status);

-- Fuel Logs
CREATE INDEX idx_fuel_logs_vehicle ON public.fuel_logs(vehicle_plate);
CREATE INDEX idx_fuel_logs_date ON public.fuel_logs(fuel_date);

-- Operations
CREATE INDEX idx_operations_vehicle ON public.operations(vehicle_plate);
CREATE INDEX idx_operations_type ON public.operations(operation_type);
CREATE INDEX idx_operations_timestamp ON public.operations(operation_timestamp);

-- Pre-operational Checklists
CREATE INDEX idx_checklists_vehicle ON public.pre_operational_checklists(vehicle_plate);
CREATE INDEX idx_checklists_date ON public.pre_operational_checklists(check_date);
CREATE INDEX idx_checklists_passed ON public.pre_operational_checklists(passed);

-- Transport Requests
CREATE INDEX idx_transport_requests_status ON public.transport_requests(status);
CREATE INDEX idx_transport_requests_requested_by ON public.transport_requests(requested_by);
CREATE INDEX idx_transport_requests_dates ON public.transport_requests(requested_date, preferred_pickup_date);

-- Expense Claims
CREATE INDEX idx_expense_claims_vehicle ON public.expense_claims(vehicle_plate);
CREATE INDEX idx_expense_claims_date ON public.expense_claims(expense_date);
CREATE INDEX idx_expense_claims_status ON public.expense_claims(status);

-- Alerts
CREATE INDEX idx_system_alerts_type ON public.system_alerts(alert_type);
CREATE INDEX idx_system_alerts_unread ON public.system_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_system_alerts_equipment ON public.system_alerts(equipment_id) WHERE equipment_id IS NOT NULL;

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operation_hours_updated_at BEFORE UPDATE ON public.operation_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fuel_logs_updated_at BEFORE UPDATE ON public.fuel_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operations_updated_at BEFORE UPDATE ON public.operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transport_requests_updated_at BEFORE UPDATE ON public.transport_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función: Calcular horas de operación automáticamente
CREATE OR REPLACE FUNCTION calculate_operation_hours()
RETURNS TRIGGER AS $$
DECLARE
    total_minutes INTEGER;
    work_minutes INTEGER;
    day_of_week INTEGER;
    check_in_hour INTEGER;
    check_in_minute INTEGER;
    is_holiday_day BOOLEAN;
    standard_minutes INTEGER;
    breakfast_deduct INTEGER := 0;
    lunch_deduct INTEGER := 0;
    reg_minutes INTEGER := 0;
    over_minutes INTEGER := 0;
    night_minutes INTEGER := 0;
    holiday_minutes INTEGER := 0;
BEGIN
    -- Solo calcular si hay check_out_time
    IF NEW.check_out_time IS NULL THEN
        RETURN NEW;
    END IF;

    -- Extraer información de tiempo
    day_of_week := EXTRACT(DOW FROM NEW.check_in_time);
    check_in_hour := EXTRACT(HOUR FROM NEW.check_in_time);
    check_in_minute := EXTRACT(MINUTE FROM NEW.check_in_time);
    
    -- Calcular minutos totales
    total_minutes := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;
    
    -- Verificar si es día festivo
    is_holiday_day := EXISTS(
        SELECT 1 FROM public.holidays 
        WHERE holiday_date = DATE(NEW.check_in_time)
    );
    
    -- Deducciones de desayuno
    IF check_in_hour < 6 OR (check_in_hour = 6 AND check_in_minute = 0) THEN
        breakfast_deduct := 60;
    END IF;
    
    -- Deducciones de almuerzo (domingos)
    IF day_of_week = 0 THEN
        lunch_deduct := 60;
    END IF;
    
    work_minutes := total_minutes - breakfast_deduct - lunch_deduct;
    
    -- Si es festivo o domingo, todas las horas son festivas
    IF is_holiday_day OR day_of_week = 0 THEN
        holiday_minutes := work_minutes;
    ELSE
        -- Determinar horas estándar según día
        IF day_of_week BETWEEN 1 AND 4 THEN
            standard_minutes := 570; -- 9.5 horas
        ELSIF day_of_week = 5 THEN
            standard_minutes := 480; -- 8 horas
        ELSIF day_of_week = 6 THEN
            standard_minutes := 180; -- 3 horas
        END IF;
        
        -- Calcular horas regulares y extras
        IF work_minutes <= standard_minutes THEN
            reg_minutes := work_minutes;
        ELSE
            reg_minutes := standard_minutes;
            over_minutes := work_minutes - standard_minutes;
        END IF;
        
        -- Horas nocturnas (21:00-06:00)
        IF check_in_hour >= 21 OR check_in_hour < 6 THEN
            night_minutes := LEAST(work_minutes, 60);
        END IF;
    END IF;
    
    -- Asignar valores calculados
    NEW.total_hours := ROUND((work_minutes / 60.0)::NUMERIC, 2);
    NEW.regular_hours := ROUND((reg_minutes / 60.0)::NUMERIC, 2);
    NEW.overtime_hours := ROUND((over_minutes / 60.0)::NUMERIC, 2);
    NEW.night_hours := ROUND((night_minutes / 60.0 * 1.35)::NUMERIC, 2);
    NEW.holiday_hours := ROUND((holiday_minutes / 60.0 * 1.75)::NUMERIC, 2);
    NEW.breakfast_deduction := ROUND((breakfast_deduct / 60.0)::NUMERIC, 2);
    NEW.lunch_deduction := ROUND((lunch_deduct / 60.0)::NUMERIC, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_hours_trigger
    BEFORE INSERT OR UPDATE OF check_out_time ON public.operation_hours
    FOR EACH ROW
    EXECUTE FUNCTION calculate_operation_hours();

-- Función: Generar alertas automáticas para documentos por vencer
CREATE OR REPLACE FUNCTION generate_expiration_alerts()
RETURNS void AS $$
DECLARE
    equipment_record RECORD;
    days_until_expiration INTEGER;
BEGIN
    -- Limpiar alertas antiguas de tipo documento
    DELETE FROM public.system_alerts 
    WHERE alert_type IN ('warning', 'error') 
      AND message LIKE '%expiration%'
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Generar alertas para cada equipo
    FOR equipment_record IN SELECT * FROM public.equipment WHERE status = 'active' LOOP
        
        -- Technical Inspection
        days_until_expiration := equipment_record.technical_inspection_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Technical inspection EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Technical inspection expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- SOAT
        days_until_expiration := equipment_record.soat_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: SOAT EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: SOAT expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- Insurance Policy
        days_until_expiration := equipment_record.insurance_policy_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Insurance EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Insurance expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- Driver License
        days_until_expiration := equipment_record.driver_license_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Driver license EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO public.system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Driver license expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener métricas del dashboard
CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS TABLE(
    total_kilometers BIGINT,
    fuel_consumption NUMERIC,
    active_vehicles BIGINT,
    expiring_documents_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(f.distance_traveled), 0)::BIGINT as total_kilometers,
        COALESCE(SUM(f.gallons), 0)::NUMERIC as fuel_consumption,
        COUNT(DISTINCT e.id)::BIGINT as active_vehicles,
        (
            SELECT COUNT(*)::BIGINT
            FROM public.equipment eq
            WHERE eq.status = 'active'
              AND (
                  eq.technical_inspection_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.soat_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.insurance_policy_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.driver_license_expiration <= CURRENT_DATE + INTERVAL '30 days'
              )
        ) as expiring_documents_count
    FROM public.equipment e
    LEFT JOIN public.fuel_logs f ON e.license_plate = f.vehicle_plate
    WHERE e.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Función: Auditar cambios en tablas
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs(table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs(table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), NEW.updated_at);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs(table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoría a tablas críticas
CREATE TRIGGER audit_equipment_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION audit_changes();

CREATE TRIGGER audit_transport_requests_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.transport_requests
    FOR EACH ROW EXECUTE FUNCTION audit_changes();

-- ============================================
-- FUNCIÓN: Sincronizar usuario de auth.users a public.users
-- ============================================
-- Esta función se ejecuta automáticamente cuando se crea un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, role, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')::VARCHAR(20),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronizar usuarios
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_operational_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Política: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Política: Todos los usuarios autenticados pueden ver equipos activos
CREATE POLICY "Authenticated users can view active equipment"
    ON public.equipment FOR SELECT
    USING (auth.role() = 'authenticated' AND status = 'active');

-- Política: Solo admins pueden modificar equipos
CREATE POLICY "Admins can manage equipment"
    ON public.equipment FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Política: Usuarios pueden ver y crear sus propios registros de horas
CREATE POLICY "Users can manage own operation hours"
    ON public.operation_hours FOR ALL
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'user')
        )
    );

-- Política: Usuarios pueden ver y crear sus propios registros de combustible
CREATE POLICY "Users can manage own fuel logs"
    ON public.fuel_logs FOR ALL
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'user')
        )
    );

-- Política: Usuarios autenticados pueden ver y crear operaciones
CREATE POLICY "Authenticated users can manage operations"
    ON public.operations FOR ALL
    USING (auth.role() = 'authenticated');

-- Política: Usuarios autenticados pueden ver y crear checklists
CREATE POLICY "Authenticated users can manage checklists"
    ON public.pre_operational_checklists FOR ALL
    USING (auth.role() = 'authenticated');

-- Política: Todos los usuarios autenticados pueden ver y crear solicitudes
CREATE POLICY "Authenticated users can manage transport requests"
    ON public.transport_requests FOR ALL
    USING (auth.role() = 'authenticated');

-- Política: Usuarios pueden ver y crear sus propios expense claims
CREATE POLICY "Users can manage own expense claims"
    ON public.expense_claims FOR ALL
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'user')
        )
    );

-- Política: Usuarios autenticados pueden ver alertas
CREATE POLICY "Authenticated users can view alerts"
    ON public.system_alerts FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Días festivos Colombia 2025
INSERT INTO public.holidays (holiday_date, holiday_name, is_mandatory) VALUES
('2025-01-01', 'Año Nuevo', true),
('2025-01-06', 'Reyes Magos', true),
('2025-03-24', 'San José', true),
('2025-04-17', 'Jueves Santo', true),
('2025-04-18', 'Viernes Santo', true),
('2025-05-01', 'Día del Trabajo', true),
('2025-06-02', 'Ascensión del Señor', true),
('2025-06-23', 'Corpus Christi', true),
('2025-06-30', 'Sagrado Corazón', true),
('2025-07-07', 'San Pedro y San Pablo', true),
('2025-07-20', 'Día de la Independencia', true),
('2025-08-07', 'Batalla de Boyacá', true),
('2025-08-18', 'Asunción de la Virgen', true),
('2025-10-13', 'Día de la Raza', true),
('2025-11-03', 'Todos los Santos', true),
('2025-11-17', 'Independencia de Cartagena', true),
('2025-12-08', 'Inmaculada Concepción', true),
('2025-12-25', 'Navidad', true)
ON CONFLICT (holiday_date) DO NOTHING;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE public.users IS 'Perfiles de usuario sincronizados con auth.users';
COMMENT ON TABLE public.equipment IS 'Vehículos y equipos de transporte';
COMMENT ON TABLE public.operation_hours IS 'Registro de horas de operación con cálculos automáticos';
COMMENT ON TABLE public.fuel_logs IS 'Registro de consumo de combustible';
COMMENT ON TABLE public.operations IS 'Tracking de operaciones logísticas';
COMMENT ON TABLE public.pre_operational_checklists IS 'Checklists pre-operacionales diarios';
COMMENT ON TABLE public.transport_requests IS 'Solicitudes de transporte';
COMMENT ON TABLE public.expense_claims IS 'Reclamaciones de gastos';
COMMENT ON TABLE public.holidays IS 'Días festivos para cálculo de horas extras';
COMMENT ON TABLE public.system_alerts IS 'Alertas del sistema';
COMMENT ON TABLE public.audit_logs IS 'Registro de auditoría de cambios';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- IMPORTANTE: Después de ejecutar este script:
-- 1. Crear usuarios en Supabase Authentication
-- 2. Los usuarios se sincronizarán automáticamente a public.users
-- 3. Actualizar el rol de los usuarios en public.users según necesidad
-- 4. Verificar que las políticas RLS funcionen correctamente
-- ============================================

