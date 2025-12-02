-- ============================================
-- AGREGAR REMOLQUES COMO VEHÍCULOS INDEPENDIENTES
-- ============================================

-- Insertar remolques sin conductor asignado
INSERT INTO equipment (
  driver_name,
  site_location,
  brand,
  license_plate,
  serial_number,
  vehicle_type,
  technical_inspection_expiration,
  soat_expiration,
  insurance_policy_expiration,
  driver_license_expiration,
  permit_status,
  status,
  department,
  notes
) VALUES
('Sin Conductor', 'GUARNE', 'Remolque', 'R80825', 'TRAILER-R80825', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a LZN095'),
('Sin Conductor', 'GUARNE', 'Remolque', 'R55535', 'TRAILER-R55535', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a KOL196'),
('Sin Conductor', 'GUARNE', 'Remolque', 'R80826', 'TRAILER-R80826', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a JUY776'),
('Sin Conductor', 'BOGOTA', 'Remolque', 'R55482', 'TRAILER-R55482', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a NOY210'),
('Sin Conductor', 'BOGOTA', 'Remolque', 'S68398', 'TRAILER-S68398', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a GEU632'),
('Sin Conductor', 'GUARNE', 'Remolque', 'S65289', 'TRAILER-S65289', 'trailer', '2099-12-31', '2099-12-31', '2099-12-31', '2099-12-31', '24 enero 2026', 'active', 'transport', 'Remolque asociado a KOK557')
ON CONFLICT (license_plate) DO UPDATE 
SET vehicle_type = 'trailer',
    status = 'active',
    department = 'transport';

-- Limpiar campo permit_status de tractores (ya no incluir remolque ahí)
UPDATE equipment 
SET permit_status = 'Vigente',
    notes = NULL
WHERE license_plate IN ('LZN095', 'KOL196', 'JUY776', 'NOY210', 'GEU632', 'KOK557');

-- Verificar
SELECT license_plate, vehicle_type, driver_name, permit_status, notes
FROM equipment 
WHERE license_plate IN ('LZN095', 'KOL196', 'JUY776', 'NOY210', 'GEU632', 'KOK557',
                        'R80825', 'R55535', 'R80826', 'R55482', 'S68398', 'S65289')
ORDER BY vehicle_type DESC, license_plate;

