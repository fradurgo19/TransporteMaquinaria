-- ============================================
-- ESQUEMA DE BASE DE DATOS - SISTEMA DE GESTIÓN DE TRANSPORTE
-- PostgreSQL 14+
-- Autor: Frank Anderson Duran Gonzalez
-- Fecha: Noviembre 2025
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA: users
-- Descripción: Usuarios del sistema con roles
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user', 'commercial')),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: equipment
-- Descripción: Vehículos y equipos de transporte
-- ============================================
CREATE TABLE equipment (
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: equipment_documents
-- Descripción: Documentos adjuntos a equipos
-- ============================================
CREATE TABLE equipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operation_hours
-- Descripción: Registro de horas de operación
-- ============================================
CREATE TABLE operation_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES equipment(license_plate),
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: fuel_logs
-- Descripción: Registro de consumo de combustible
-- ============================================
CREATE TABLE fuel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES equipment(license_plate),
    
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operations
-- Descripción: Tracking de operaciones logísticas
-- ============================================
CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES equipment(license_plate),
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: operation_photos
-- Descripción: Fotos de documentación de operaciones
-- ============================================
CREATE TABLE operation_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    photo_path VARCHAR(500) NOT NULL,
    photo_description VARCHAR(255),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: pre_operational_checklists
-- Descripción: Checklists pre-operacionales diarios
-- ============================================
CREATE TABLE pre_operational_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_plate VARCHAR(50) NOT NULL REFERENCES equipment(license_plate),
    driver_name VARCHAR(255) NOT NULL,
    
    -- Fecha y hora de inspección
    check_date DATE NOT NULL,
    check_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Items de inspección (JSON para flexibilidad)
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: transport_requests
-- Descripción: Solicitudes de transporte
-- ============================================
CREATE TABLE transport_requests (
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
    assigned_vehicle VARCHAR(50) REFERENCES equipment(license_plate),
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
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: holidays
-- Descripción: Días festivos para cálculo de horas
-- ============================================
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date DATE UNIQUE NOT NULL,
    holiday_name VARCHAR(255) NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: system_alerts
-- Descripción: Alertas del sistema
-- ============================================
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'error', 'info', 'success')),
    message TEXT NOT NULL,
    
    -- Relacionado a
    equipment_id UUID REFERENCES equipment(id),
    user_id UUID REFERENCES users(id),
    
    -- Estado
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLA: audit_logs
-- Descripción: Registro de auditoría de cambios
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Equipment
CREATE INDEX idx_equipment_license_plate ON equipment(license_plate);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_driver ON equipment(driver_name);
CREATE INDEX idx_equipment_expirations ON equipment(technical_inspection_expiration, soat_expiration, insurance_policy_expiration, driver_license_expiration);

-- Operation Hours
CREATE INDEX idx_operation_hours_vehicle ON operation_hours(vehicle_plate);
CREATE INDEX idx_operation_hours_driver ON operation_hours(driver_name);
CREATE INDEX idx_operation_hours_dates ON operation_hours(check_in_time, check_out_time);
CREATE INDEX idx_operation_hours_status ON operation_hours(status);

-- Fuel Logs
CREATE INDEX idx_fuel_logs_vehicle ON fuel_logs(vehicle_plate);
CREATE INDEX idx_fuel_logs_date ON fuel_logs(fuel_date);

-- Operations
CREATE INDEX idx_operations_vehicle ON operations(vehicle_plate);
CREATE INDEX idx_operations_type ON operations(operation_type);
CREATE INDEX idx_operations_timestamp ON operations(operation_timestamp);

-- Pre-operational Checklists
CREATE INDEX idx_checklists_vehicle ON pre_operational_checklists(vehicle_plate);
CREATE INDEX idx_checklists_date ON pre_operational_checklists(check_date);
CREATE INDEX idx_checklists_passed ON pre_operational_checklists(passed);

-- Transport Requests
CREATE INDEX idx_transport_requests_status ON transport_requests(status);
CREATE INDEX idx_transport_requests_requested_by ON transport_requests(requested_by);
CREATE INDEX idx_transport_requests_dates ON transport_requests(requested_date, preferred_pickup_date);

-- Alerts
CREATE INDEX idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX idx_system_alerts_unread ON system_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_system_alerts_equipment ON system_alerts(equipment_id) WHERE equipment_id IS NOT NULL;

-- ============================================
-- COMENTARIOS EN TABLAS
-- ============================================
COMMENT ON TABLE users IS 'Usuarios del sistema con roles de acceso';
COMMENT ON TABLE equipment IS 'Vehículos y equipos de transporte';
COMMENT ON TABLE operation_hours IS 'Registro de horas de operación con cálculos automáticos';
COMMENT ON TABLE fuel_logs IS 'Registro de consumo de combustible';
COMMENT ON TABLE operations IS 'Tracking de operaciones logísticas';
COMMENT ON TABLE pre_operational_checklists IS 'Checklists pre-operacionales diarios';
COMMENT ON TABLE transport_requests IS 'Solicitudes de transporte';
COMMENT ON TABLE holidays IS 'Días festivos para cálculo de horas extras';
COMMENT ON TABLE system_alerts IS 'Alertas del sistema';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de cambios';

