-- ============================================
-- ASIGNAR CONDUCTORES A VEHÍCULOS
-- ============================================

-- 1. Agregar columna para asignar conductor
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES users(id);

-- 2. Asignar conductores a sus vehículos
UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'ariel@partequipos.com')
WHERE license_plate = 'LZN095';

UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'jorge@partequipos.com')
WHERE license_plate = 'KOL196';

UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'juancarlos@partequipos.com')
WHERE license_plate = 'JUY776';

UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'marcos@partequipos.com')
WHERE license_plate = 'NOY210';

UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'rodolfo@partequipos.com')
WHERE license_plate = 'GEU632';

UPDATE equipment SET assigned_driver_id = (SELECT id FROM users WHERE email = 'eduar.canas@partequipos.com')
WHERE license_plate = 'KOK557';

-- 3. Verificar asignaciones
SELECT 
  e.license_plate,
  e.driver_name,
  u.email as assigned_email,
  u.full_name as assigned_full_name
FROM equipment e
LEFT JOIN users u ON e.assigned_driver_id = u.id
WHERE e.license_plate IN ('LZN095', 'KOL196', 'JUY776', 'NOY210', 'GEU632', 'KOK557')
ORDER BY e.license_plate;

