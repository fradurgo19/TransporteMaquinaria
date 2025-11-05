-- ============================================
-- DATOS DE PRUEBA - SISTEMA DE GESTIÓN DE TRANSPORTE
-- PostgreSQL 14+
-- ============================================

-- IMPORTANTE: Estas contraseñas son de ejemplo para desarrollo
-- En producción deben ser diferentes y seguras

-- ============================================
-- USUARIOS DE PRUEBA
-- ============================================

-- Password para todos: "Password123!"
INSERT INTO users (id, username, email, password_hash, role, full_name, phone) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', 'admin@partequipos.com', 'Password123!', 'admin', 'Administrador Sistema', '+57 300 123 4567'),
('00000000-0000-0000-0000-000000000002', 'user1', 'user1@partequipos.com', 'Password123!', 'user', 'Juan Pérez', '+57 300 234 5678'),
('00000000-0000-0000-0000-000000000003', 'comercial', 'comercial@partequipos.com', 'Password123!', 'commercial', 'María González', '+57 300 345 6789'),
('00000000-0000-0000-0000-000000000004', 'user2', 'user2@partequipos.com', 'Password123!', 'user', 'Carlos Rodríguez', '+57 300 456 7890');

-- ============================================
-- EQUIPOS (VEHÍCULOS)
-- ============================================
INSERT INTO equipment (id, driver_name, site_location, brand, license_plate, serial_number, vehicle_type, 
                       technical_inspection_expiration, soat_expiration, insurance_policy_expiration, 
                       driver_license_expiration, permit_status, status, current_odometer, created_by) VALUES
('10000000-0000-0000-0000-000000000001', 'Juan Pérez', 'Sede Bogotá', 'Volvo', 'ABC-123', 'VLV-2023-001', 'tractor', 
 '2025-12-15', '2026-01-20', '2025-12-31', '2026-06-30', 'Vigente', 'active', 125000, '00000000-0000-0000-0000-000000000001'),

('10000000-0000-0000-0000-000000000002', 'Carlos Rodríguez', 'Sede Medellín', 'Kenworth', 'XYZ-789', 'KEN-2023-002', 'tractor', 
 '2025-11-30', '2025-12-15', '2026-02-28', '2026-08-15', 'Vigente', 'active', 98000, '00000000-0000-0000-0000-000000000001'),

('10000000-0000-0000-0000-000000000003', 'Pedro Martínez', 'Sede Cali', 'Freightliner', 'DEF-456', 'FRE-2023-003', 'tractor', 
 '2025-11-10', '2025-11-25', '2025-12-20', '2026-05-10', 'Vigente', 'active', 156000, '00000000-0000-0000-0000-000000000001'),

('10000000-0000-0000-0000-000000000004', 'Luis García', 'Sede Barranquilla', 'Mack', 'GHI-321', 'MCK-2023-004', 'tractor', 
 '2026-03-15', '2026-04-20', '2026-03-30', '2026-09-20', 'Vigente', 'active', 87000, '00000000-0000-0000-0000-000000000001'),

('10000000-0000-0000-0000-000000000005', 'Miguel Torres', 'Sede Bogotá', 'International', 'JKL-654', 'INT-2023-005', 'trailer', 
 '2025-11-20', '2025-12-05', '2026-01-15', '2026-07-25', 'Vigente', 'active', 112000, '00000000-0000-0000-0000-000000000001'),

('10000000-0000-0000-0000-000000000006', 'Roberto Sánchez', 'Sede Medellín', 'Volvo', 'MNO-987', 'VLV-2022-006', 'trailer', 
 '2025-10-30', '2025-11-15', '2025-12-25', '2026-04-30', 'Vigente', 'maintenance', 203000, '00000000-0000-0000-0000-000000000001');

-- ============================================
-- DÍAS FESTIVOS COLOMBIA 2025
-- ============================================
INSERT INTO holidays (holiday_date, holiday_name, is_mandatory) VALUES
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
('2025-12-25', 'Navidad', true);

-- ============================================
-- HORAS DE OPERACIÓN (Ejemplos)
-- ============================================
INSERT INTO operation_hours (id, vehicle_plate, driver_name, check_in_time, check_out_time, 
                             task_description, location_latitude, location_longitude, 
                             activity_type, status, created_by) VALUES
-- Día normal completo
('20000000-0000-0000-0000-000000000001', 'ABC-123', 'Juan Pérez', 
 '2025-11-04 08:00:00-05', '2025-11-04 17:30:00-05',
 'Transporte de maquinaria pesada desde Bogotá a Chía', 
 4.6097, -74.0817, 'regular', 'completed', '00000000-0000-0000-0000-000000000002'),

-- Día con horas extras
('20000000-0000-0000-0000-000000000002', 'XYZ-789', 'Carlos Rodríguez', 
 '2025-11-04 08:00:00-05', '2025-11-04 20:00:00-05',
 'Entrega urgente en Medellín', 
 6.2442, -75.5812, 'overtime', 'completed', '00000000-0000-0000-0000-000000000004'),

-- Turno nocturno
('20000000-0000-0000-0000-000000000003', 'DEF-456', 'Pedro Martínez', 
 '2025-11-03 22:00:00-05', '2025-11-04 06:00:00-05',
 'Transporte nocturno Cali - Popayán', 
 3.4516, -76.5320, 'night', 'completed', '00000000-0000-0000-0000-000000000002'),

-- Entrada temprana (con deducción de desayuno)
('20000000-0000-0000-0000-000000000004', 'GHI-321', 'Luis García', 
 '2025-11-04 05:30:00-05', '2025-11-04 17:00:00-05',
 'Carga y transporte desde Barranquilla', 
 10.9685, -74.7813, 'regular', 'completed', '00000000-0000-0000-0000-000000000004'),

-- Registro en progreso
('20000000-0000-0000-0000-000000000005', 'JKL-654', 'Miguel Torres', 
 '2025-11-04 08:30:00-05', NULL,
 'Ruta en curso hacia Villavicencio', 
 4.6097, -74.0817, 'regular', 'in_progress', '00000000-0000-0000-0000-000000000002');

-- ============================================
-- REGISTROS DE COMBUSTIBLE
-- ============================================
INSERT INTO fuel_logs (id, vehicle_plate, fuel_date, gallons, cost, starting_odometer, 
                       ending_odometer, gps_latitude, gps_longitude, gas_station_name, created_by) VALUES
('30000000-0000-0000-0000-000000000001', 'ABC-123', '2025-11-01', 45.5, 273000, 124500, 125000, 
 4.6097, -74.0817, 'Terpel Centro', '00000000-0000-0000-0000-000000000002'),

('30000000-0000-0000-0000-000000000002', 'XYZ-789', '2025-11-02', 38.2, 229200, 97600, 98000, 
 6.2442, -75.5812, 'Esso Norte', '00000000-0000-0000-0000-000000000004'),

('30000000-0000-0000-0000-000000000003', 'DEF-456', '2025-11-02', 52.3, 313800, 155400, 156000, 
 3.4516, -76.5320, 'Mobil Sur', '00000000-0000-0000-0000-000000000002'),

('30000000-0000-0000-0000-000000000004', 'GHI-321', '2025-11-03', 41.8, 250800, 86650, 87000, 
 10.9685, -74.7813, 'Texaco Costa', '00000000-0000-0000-0000-000000000004'),

('30000000-0000-0000-0000-000000000005', 'JKL-654', '2025-11-03', 47.2, 283200, 111450, 112000, 
 4.6097, -74.0817, 'Terpel 80', '00000000-0000-0000-0000-000000000002');

-- ============================================
-- OPERACIONES DE TRANSPORTE
-- ============================================
INSERT INTO operations (id, vehicle_plate, driver_name, operation_timestamp, operation_type, 
                       gps_latitude, gps_longitude, cargo_description, cargo_weight, 
                       origin, destination, status, created_by) VALUES
('40000000-0000-0000-0000-000000000001', 'ABC-123', 'Juan Pérez', '2025-11-04 08:15:00-05', 'loading',
 4.6097, -74.0817, 'Excavadora Caterpillar 320D', 21000, 'Bogotá - Bodega Central', 'Chía - Obra Los Arrayanes', 
 'completed', '00000000-0000-0000-0000-000000000002'),

('40000000-0000-0000-0000-000000000002', 'ABC-123', 'Juan Pérez', '2025-11-04 09:30:00-05', 'route_start',
 4.6534, -74.0561, 'Excavadora Caterpillar 320D', 21000, 'Bogotá - Bodega Central', 'Chía - Obra Los Arrayanes', 
 'completed', '00000000-0000-0000-0000-000000000002'),

('40000000-0000-0000-0000-000000000003', 'ABC-123', 'Juan Pérez', '2025-11-04 11:15:00-05', 'delivery',
 4.8653, -74.0531, 'Excavadora Caterpillar 320D', 21000, 'Bogotá - Bodega Central', 'Chía - Obra Los Arrayanes', 
 'completed', '00000000-0000-0000-0000-000000000002'),

('40000000-0000-0000-0000-000000000004', 'XYZ-789', 'Carlos Rodríguez', '2025-11-04 07:45:00-05', 'loading',
 6.2442, -75.5812, 'Bulldozer Komatsu D65', 18500, 'Medellín - Zona Industrial', 'Rionegro - Aeropuerto', 
 'completed', '00000000-0000-0000-0000-000000000004'),

('40000000-0000-0000-0000-000000000005', 'JKL-654', 'Miguel Torres', '2025-11-04 08:45:00-05', 'route_start',
 4.6097, -74.0817, 'Retroexcavadora JCB 3CX', 8500, 'Bogotá - Bodega Sur', 'Villavicencio - Obra Puente', 
 'in_progress', '00000000-0000-0000-0000-000000000002');

-- ============================================
-- CHECKLISTS PRE-OPERACIONALES
-- ============================================
INSERT INTO pre_operational_checklists (id, vehicle_plate, driver_name, check_date, check_time,
                                       tire_condition, brake_condition, lights_condition, 
                                       fluid_levels, engine_condition, vehicle_condition_assessment,
                                       passed, created_by) VALUES
('50000000-0000-0000-0000-000000000001', 'ABC-123', 'Juan Pérez', '2025-11-04', '2025-11-04 07:30:00-05',
 'good', 'good', 'good', 'good', 'good', 
 'Vehículo en excelentes condiciones. Todos los sistemas funcionando correctamente.', 
 true, '00000000-0000-0000-0000-000000000002'),

('50000000-0000-0000-0000-000000000002', 'XYZ-789', 'Carlos Rodríguez', '2025-11-04', '2025-11-04 07:15:00-05',
 'good', 'fair', 'good', 'good', 'good', 
 'Frenos requieren revisión pronto pero están operativos. Resto en buen estado.', 
 true, '00000000-0000-0000-0000-000000000004'),

('50000000-0000-0000-0000-000000000003', 'DEF-456', 'Pedro Martínez', '2025-11-03', '2025-11-03 21:45:00-05',
 'good', 'good', 'fair', 'good', 'good', 
 'Luz delantera derecha con intermitencia. Programada para revisión mañana.', 
 true, '00000000-0000-0000-0000-000000000002'),

('50000000-0000-0000-0000-000000000004', 'GHI-321', 'Luis García', '2025-11-04', '2025-11-04 05:00:00-05',
 'good', 'good', 'good', 'fair', 'good', 
 'Nivel de aceite ligeramente bajo. Se agregará al regresar a base.', 
 true, '00000000-0000-0000-0000-000000000004'),

('50000000-0000-0000-0000-000000000005', 'MNO-987', 'Roberto Sánchez', '2025-11-03', '2025-11-03 08:00:00-05',
 'poor', 'fair', 'good', 'good', 'critical', 
 'Motor con ruido anormal. Neumático trasero desgastado. Vehículo enviado a mantenimiento.', 
 false, '00000000-0000-0000-0000-000000000004');

-- ============================================
-- SOLICITUDES DE TRANSPORTE
-- ============================================
INSERT INTO transport_requests (id, serial_number, brand, model, weight, length, capacity,
                                origin, destination, status, requested_date, preferred_pickup_date,
                                priority, notes, requested_by) VALUES
('60000000-0000-0000-0000-000000000001', 'CAT-2023-789', 'Caterpillar', '320D Excavator', 21000, 9.5, 0.5,
 'Bogotá - Bodega Norte', 'Chía - Proyecto Residencial Los Pinos', 'completed', '2025-11-01', '2025-11-03',
 'normal', 'Excavadora para construcción de cimentación. Incluye operador.', 
 '00000000-0000-0000-0000-000000000003'),

('60000000-0000-0000-0000-000000000002', 'KOM-2023-456', 'Komatsu', 'D65 Bulldozer', 18500, 5.8, 0,
 'Medellín - Zona Industrial', 'Rionegro - Expansión Aeropuerto', 'in_progress', '2025-11-03', '2025-11-04',
 'high', 'Transporte urgente. Cliente esperando en sitio. Priorizar entrega AM.', 
 '00000000-0000-0000-0000-000000000003'),

('60000000-0000-0000-0000-000000000003', 'JCB-2023-321', 'JCB', '3CX Backhoe Loader', 8500, 5.5, 1.2,
 'Bogotá - Bodega Sur', 'Villavicencio - Construcción Puente', 'approved', '2025-11-04', '2025-11-05',
 'normal', 'Retroexcavadora para trabajos de excavación. Coordinación con ingeniero en sitio.', 
 '00000000-0000-0000-0000-000000000003'),

('60000000-0000-0000-0000-000000000004', 'VOL-2023-654', 'Volvo', 'EC480D Excavator', 48000, 12.3, 2.3,
 'Cali - Puerto Seco', 'Popayán - Minería El Tambo', 'pending', '2025-11-04', '2025-11-08',
 'urgent', 'Excavadora de gran tonelaje. Requiere vehículo especializado y permisos especiales.', 
 '00000000-0000-0000-0000-000000000003'),

('60000000-0000-0000-0000-000000000005', 'LBH-2023-987', 'Liebherr', 'R956 Excavator', 56000, 14.2, 3.5,
 'Barranquilla - Zona Franca', 'Santa Marta - Proyecto Carbón', 'rejected', '2025-11-02', '2025-11-03',
 'urgent', 'Requería transporte inmediato. Rechazado por falta de disponibilidad vehicular.', 
 '00000000-0000-0000-0000-000000000003');

-- ============================================
-- ALERTAS DEL SISTEMA
-- ============================================

-- Generar alertas automáticas
SELECT generate_expiration_alerts();

-- Alertas adicionales manuales
INSERT INTO system_alerts (alert_type, message, equipment_id) VALUES
('warning', 'Vehicle MNO-987 is in maintenance status for more than 48 hours', '10000000-0000-0000-0000-000000000006'),
('info', 'New transport request received: CAT-2023-789 to Chía', NULL),
('success', 'All vehicles passed pre-operational inspection today', NULL);

-- ============================================
-- VERIFICACIÓN DE DATOS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Database seeded successfully!';
    RAISE NOTICE 'Users created: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE 'Equipment created: %', (SELECT COUNT(*) FROM equipment);
    RAISE NOTICE 'Operation hours: %', (SELECT COUNT(*) FROM operation_hours);
    RAISE NOTICE 'Fuel logs: %', (SELECT COUNT(*) FROM fuel_logs);
    RAISE NOTICE 'Operations: %', (SELECT COUNT(*) FROM operations);
    RAISE NOTICE 'Checklists: %', (SELECT COUNT(*) FROM pre_operational_checklists);
    RAISE NOTICE 'Transport requests: %', (SELECT COUNT(*) FROM transport_requests);
    RAISE NOTICE 'System alerts: %', (SELECT COUNT(*) FROM system_alerts);
    RAISE NOTICE '---';
    RAISE NOTICE 'Test credentials:';
    RAISE NOTICE 'Admin: admin@partequipos.com / Password123!';
    RAISE NOTICE 'User: user1@partequipos.com / Password123!';
    RAISE NOTICE 'Commercial: comercial@partequipos.com / Password123!';
END $$;

