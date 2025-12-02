-- ============================================
-- AGREGAR USUARIOS Y VEHÍCULOS DE TRANSPORTE
-- ============================================

-- 1. CREAR USUARIOS EN SUPABASE AUTH (manual)
-- Ir a Supabase Dashboard → Authentication → Users → Add user
-- Crear estos usuarios con password: Password123!
-- - ariel@partequipos.com
-- - eduar.canas@partequipos.com  
-- - jhon.torres@partequipos.com
-- - jorge@partequipos.com
-- - juancarlos@partequipos.com
-- - marcos@partequipos.com

-- 2. INSERTAR EN TABLA USERS (ejecutar DESPUÉS de crear en Auth)
INSERT INTO users (id, email, username, role, full_name)
SELECT 
  au.id,
  au.email,
  SPLIT_PART(au.email, '@', 1),
  'user',
  CASE 
    WHEN au.email = 'ariel@partequipos.com' THEN 'Ariel'
    WHEN au.email = 'eduar.canas@partequipos.com' THEN 'Eduar Cañas'
    WHEN au.email = 'jhon.torres@partequipos.com' THEN 'Jhon Torres'
    WHEN au.email = 'jorge@partequipos.com' THEN 'Jorge'
    WHEN au.email = 'juancarlos@partequipos.com' THEN 'Juan Carlos'
    WHEN au.email = 'marcos@partequipos.com' THEN 'Marcos'
  END
FROM auth.users au
WHERE au.email IN (
  'ariel@partequipos.com',
  'eduar.canas@partequipos.com',
  'jhon.torres@partequipos.com',
  'jorge@partequipos.com',
  'juancarlos@partequipos.com',
  'marcos@partequipos.com'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'user', 
    full_name = EXCLUDED.full_name;

-- 3. ACTUALIZAR NOMBRES COMPLETOS DE CONDUCTORES
UPDATE users SET full_name = 'Ariel Solarte Gil' WHERE email = 'ariel@partequipos.com';
UPDATE users SET full_name = 'Eduar Cañas Nuñez' WHERE email = 'eduar.canas@partequipos.com';
UPDATE users SET full_name = 'John Jairo Torres Galindo' WHERE email = 'jhon.torres@partequipos.com';
UPDATE users SET full_name = 'Jorge Mario Arango' WHERE email = 'jorge@partequipos.com';
UPDATE users SET full_name = 'Juan Carlos Varon Moreno' WHERE email = 'juancarlos@partequipos.com';
UPDATE users SET full_name = 'Marcos Espitia Quintero' WHERE email = 'marcos@partequipos.com';

-- Crear usuario adicional: Rodolfo (que faltaba)
-- NOTA: Primero crear en Auth: rodolfo@partequipos.com

-- 4. INSERTAR/ACTUALIZAR VEHÍCULOS CON INFORMACIÓN COMPLETA
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
('Ariel Solarte Gil', 'GUARNE', 'INTERNATIONAL', 'LZN095', '3HSDZAPT1PN118015', 'tractor', '2026-07-15', '2026-07-13', '2026-06-01', '2026-07-03', 'R80825 - 24 enero 2026', 'active', 'transport', 'Remolque: R80825'),
('Jorge Mario Arango', 'GUARNE', 'FREIGHTLINER', 'KOL196', '1FUJHTDV6MLML0486', 'tractor', '2026-08-12', '2026-08-24', '2026-06-01', '2028-05-22', 'R55535 - 24 enero 2026', 'active', 'transport', 'Remolque: R55535'),
('Juan Carlos Varon Moreno', 'GUARNE', 'FREIGHTLINER', 'JUY776', '1FUJHTDVXMLMG5477', 'tractor', '2026-07-04', '2026-07-09', '2026-06-01', '2026-09-07', 'R80826 - 24 enero 2026', 'active', 'transport', 'Remolque: R80826'),
('Marcos Espitia Quintero', 'BOGOTA', 'INTERNATIONAL', 'NOY210', '3HSDZAPT1PN678391', 'tractor', '2026-07-30', '2026-07-18', '2026-06-01', '2027-03-22', 'R55482 - 24 enero 2026', 'active', 'transport', 'Remolque: R55482'),
('Rodolfo Lozano Castro', 'BOGOTA', 'HINO-MINIMULA', 'GEU632', '9F3SG1AF7LXX10101', 'tractor', '2026-09-30', '2026-09-09', '2026-06-01', '2026-08-26', 'S68398 - 24 enero 2026', 'active', 'transport', 'Remolque: S68398'),
('Eduar Cañas Nuñez', 'GUARNE', 'INTERNATIONAL', 'KOK557', '3HSDJAPT0NN462780', 'tractor', '2026-08-04', '2025-08-01', '2026-06-01', '2025-11-11', 'S65289 - 24 enero 2026', 'active', 'transport', 'Remolque: S65289')
ON CONFLICT (license_plate) DO UPDATE 
SET driver_name = EXCLUDED.driver_name,
    site_location = EXCLUDED.site_location,
    brand = EXCLUDED.brand,
    serial_number = EXCLUDED.serial_number,
    technical_inspection_expiration = EXCLUDED.technical_inspection_expiration,
    soat_expiration = EXCLUDED.soat_expiration,
    insurance_policy_expiration = EXCLUDED.insurance_policy_expiration,
    driver_license_expiration = EXCLUDED.driver_license_expiration,
    permit_status = EXCLUDED.permit_status,
    notes = EXCLUDED.notes,
    status = 'active',
    department = 'transport';

-- 4. VERIFICAR
SELECT license_plate, driver_name, status, department FROM equipment 
WHERE license_plate IN ('GEU632', 'JUY776', 'KOK557', 'KOL196', 'LZN095', 'NOY210')
ORDER BY license_plate;

SELECT email, role, full_name FROM users 
WHERE email IN (
  'ariel@partequipos.com',
  'eduar.canas@partequipos.com',
  'jhon.torres@partequipos.com',
  'jorge@partequipos.com',
  'juancarlos@partequipos.com',
  'marcos@partequipos.com'
);

