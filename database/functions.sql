-- ============================================
-- FUNCIONES Y TRIGGERS - SISTEMA DE GESTIÓN DE TRANSPORTE
-- PostgreSQL 14+
-- ============================================

-- ============================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operation_hours_updated_at BEFORE UPDATE ON operation_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fuel_logs_updated_at BEFORE UPDATE ON fuel_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operations_updated_at BEFORE UPDATE ON operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transport_requests_updated_at BEFORE UPDATE ON transport_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCIÓN: Hash de contraseñas con bcrypt
-- ============================================
CREATE OR REPLACE FUNCTION hash_password()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.password_hash != OLD.password_hash) THEN
        -- En producción, el hash se debe hacer desde la aplicación
        -- Esta función es solo para desarrollo/testing
        NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN: Verificar contraseña
-- ============================================
CREATE OR REPLACE FUNCTION verify_password(user_email TEXT, user_password TEXT)
RETURNS TABLE(id UUID, username VARCHAR, email VARCHAR, role VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.email, u.role
    FROM users u
    WHERE u.email = user_email
      AND u.password_hash = crypt(user_password, u.password_hash)
      AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: Calcular horas de operación automáticamente
-- ============================================
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
    day_of_week := EXTRACT(DOW FROM NEW.check_in_time); -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    check_in_hour := EXTRACT(HOUR FROM NEW.check_in_time);
    check_in_minute := EXTRACT(MINUTE FROM NEW.check_in_time);
    
    -- Calcular minutos totales
    total_minutes := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;
    
    -- Verificar si es día festivo
    is_holiday_day := EXISTS(
        SELECT 1 FROM holidays 
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
        -- Esta es una simplificación, en producción debería iterar por cada hora
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
    BEFORE INSERT OR UPDATE OF check_out_time ON operation_hours
    FOR EACH ROW
    EXECUTE FUNCTION calculate_operation_hours();

-- ============================================
-- FUNCIÓN: Generar alertas automáticas para documentos por vencer
-- ============================================
CREATE OR REPLACE FUNCTION generate_expiration_alerts()
RETURNS void AS $$
DECLARE
    equipment_record RECORD;
    days_until_expiration INTEGER;
    alert_message TEXT;
BEGIN
    -- Limpiar alertas antiguas de tipo documento
    DELETE FROM system_alerts 
    WHERE alert_type IN ('warning', 'error') 
      AND message LIKE '%expiration%'
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Generar alertas para cada equipo
    FOR equipment_record IN SELECT * FROM equipment WHERE status = 'active' LOOP
        
        -- Technical Inspection
        days_until_expiration := equipment_record.technical_inspection_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Technical inspection EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Technical inspection expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- SOAT
        days_until_expiration := equipment_record.soat_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: SOAT EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: SOAT expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- Insurance Policy
        days_until_expiration := equipment_record.insurance_policy_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Insurance EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Insurance expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
        -- Driver License
        days_until_expiration := equipment_record.driver_license_expiration - CURRENT_DATE;
        IF days_until_expiration <= 0 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('error', 
                    format('Vehicle %s: Driver license EXPIRED %s days ago', 
                           equipment_record.license_plate, ABS(days_until_expiration)),
                    equipment_record.id);
        ELSIF days_until_expiration <= 30 THEN
            INSERT INTO system_alerts (alert_type, message, equipment_id)
            VALUES ('warning', 
                    format('Vehicle %s: Driver license expires in %s days', 
                           equipment_record.license_plate, days_until_expiration),
                    equipment_record.id);
        END IF;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN: Obtener métricas del dashboard
-- ============================================
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
            FROM equipment eq
            WHERE eq.status = 'active'
              AND (
                  eq.technical_inspection_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.soat_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.insurance_policy_expiration <= CURRENT_DATE + INTERVAL '30 days' OR
                  eq.driver_license_expiration <= CURRENT_DATE + INTERVAL '30 days'
              )
        ) as expiring_documents_count
    FROM equipment e
    LEFT JOIN fuel_logs f ON e.license_plate = f.vehicle_plate
    WHERE e.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN: Auditar cambios en tablas
-- ============================================
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs(table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs(table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), NEW.updated_at);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs(table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoría a tablas críticas
CREATE TRIGGER audit_equipment_changes
    AFTER INSERT OR UPDATE OR DELETE ON equipment
    FOR EACH ROW EXECUTE FUNCTION audit_changes();

CREATE TRIGGER audit_transport_requests_changes
    AFTER INSERT OR UPDATE OR DELETE ON transport_requests
    FOR EACH ROW EXECUTE FUNCTION audit_changes();

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON FUNCTION update_updated_at_column() IS 'Actualiza automáticamente el campo updated_at';
COMMENT ON FUNCTION calculate_operation_hours() IS 'Calcula automáticamente las horas de operación con multiplicadores';
COMMENT ON FUNCTION generate_expiration_alerts() IS 'Genera alertas para documentos próximos a vencer';
COMMENT ON FUNCTION get_dashboard_metrics() IS 'Obtiene métricas agregadas para el dashboard';
COMMENT ON FUNCTION audit_changes() IS 'Registra cambios en tablas para auditoría';

