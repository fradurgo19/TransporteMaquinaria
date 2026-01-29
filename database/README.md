# 🗄️ Base de Datos - Sistema de Gestión de Transporte

Documentación completa del esquema de base de datos PostgreSQL.

## 📋 Tabla de Contenidos

- [Estructura General](#estructura-general)
- [Tablas Principales](#tablas-principales)
- [Relaciones](#relaciones)
- [Funciones y Triggers](#funciones-y-triggers)
- [Instalación](#instalación)
- [Migraciones](#migraciones)

---

## 📊 Estructura General

La base de datos está diseñada siguiendo las mejores prácticas de PostgreSQL 14+ con:

- ✅ UUID como claves primarias
- ✅ Timestamps automáticos (created_at, updated_at)
- ✅ Soft deletes donde sea necesario
- ✅ Índices estratégicos para optimización
- ✅ Triggers para cálculos automáticos
- ✅ Funciones para lógica de negocio
- ✅ Auditoría completa de cambios
- ✅ Constraints para integridad de datos

---

## 🗂️ Tablas Principales

### 1. **users**
Usuarios del sistema con roles de acceso.

**Campos principales:**
- `id` (UUID) - Identificador único
- `username` (VARCHAR) - Nombre de usuario único
- `email` (VARCHAR) - Email único
- `password_hash` (VARCHAR) - Hash de contraseña (bcrypt)
- `role` (VARCHAR) - Rol: 'admin', 'user', 'commercial'
- `is_active` (BOOLEAN) - Estado del usuario
- `last_login` (TIMESTAMP) - Última sesión

**Roles:**
- **admin**: Acceso completo, CRUD en todos los módulos
- **user**: Acceso operativo, puede registrar horas, combustible, operaciones
- **commercial**: Acceso a solicitudes de transporte, vistas limitadas

---

### 2. **equipment**
Vehículos y equipos de transporte.

**Campos principales:**
- `id` (UUID) - Identificador único
- `license_plate` (VARCHAR) - Placa única
- `serial_number` (VARCHAR) - Número de serie único
- `vehicle_type` (VARCHAR) - 'tractor' o 'trailer'
- `brand` (VARCHAR) - Marca del vehículo
- `driver_name` (VARCHAR) - Conductor asignado
- `site_location` (VARCHAR) - Ubicación actual
- `technical_inspection_expiration` (DATE) - Vencimiento revisión técnica
- `soat_expiration` (DATE) - Vencimiento SOAT
- `insurance_policy_expiration` (DATE) - Vencimiento seguro
- `driver_license_expiration` (DATE) - Vencimiento licencia conductor
- `last_gps_latitude/longitude` (DECIMAL) - Última ubicación GPS
- `current_odometer` (INTEGER) - Odómetro actual
- `status` (VARCHAR) - 'active', 'maintenance', 'inactive', 'retired'

**Alertas automáticas:**
- Se generan alertas cuando los documentos están por vencer (<30 días)

---

### 3. **operation_hours**
Registro de horas de operación con cálculo automático de horas extras.

**Campos principales:**
- `id` (UUID) - Identificador único
- `vehicle_plate` (VARCHAR) - FK a equipment
- `driver_name` (VARCHAR) - Nombre del conductor
- `check_in_time` (TIMESTAMP) - Hora de entrada
- `check_out_time` (TIMESTAMP) - Hora de salida (nullable si en progreso)
- `task_description` (TEXT) - Descripción de la tarea
- `location_latitude/longitude` (DECIMAL) - Ubicación GPS
- `activity_type` (VARCHAR) - 'regular', 'overtime', 'night', 'holiday'

**Campos calculados automáticamente:**
- `total_hours` - Horas totales trabajadas
- `regular_hours` - Horas normales
- `overtime_hours` - Horas extras
- `night_hours` - Horas nocturnas (21:00-06:00) × 1.35
- `holiday_hours` - Horas festivas × 1.75
- `breakfast_deduction` - Deducción desayuno
- `lunch_deduction` - Deducción almuerzo

**Reglas de cálculo:**
- **Lunes-Jueves:** 8:00-17:30 (9.5 horas estándar)
- **Viernes:** 8:00-16:00 (8 horas estándar)
- **Sábado:** 9:00-12:00 (3 horas estándar)
- **Domingo:** Todo hora festiva × 1.75, deducción 2 horas (desayuno + almuerzo)
- **Entrada antes 6:00 AM:** Deducción 1 hora desayuno
- **Entrada 6:00 AM exacto:** Deducción 1 hora desayuno
- **Horas nocturnas (21:00-06:00):** × 1.35 multiplicador

---

### 4. **fuel_logs**
Registro de consumo de combustible.

**Campos principales:**
- `id` (UUID) - Identificador único
- `vehicle_plate` (VARCHAR) - FK a equipment
- `fuel_date` (DATE) - Fecha de carga
- `gallons` (DECIMAL) - Galones cargados
- `cost` (DECIMAL) - Costo total
- `starting_odometer` (INTEGER) - Odómetro inicial
- `ending_odometer` (INTEGER) - Odómetro final
- `receipt_photo_path` (VARCHAR) - Path de foto recibo
- `gps_latitude/longitude` (DECIMAL) - Ubicación GPS
- `gas_station_name` (VARCHAR) - Nombre estación

**Campos generados:**
- `distance_traveled` - Calculado: ending - starting
- `fuel_efficiency` - Calculado: km/galón

---

### 5. **operations**
Tracking de operaciones logísticas (carga, ruta, entrega).

**Campos principales:**
- `id` (UUID) - Identificador único
- `vehicle_plate` (VARCHAR) - FK a equipment
- `driver_name` (VARCHAR) - Conductor
- `operation_timestamp` (TIMESTAMP) - Fecha/hora operación
- `operation_type` (VARCHAR) - 'loading', 'route_start', 'delivery'
- `gps_latitude/longitude` (DECIMAL) - Ubicación GPS
- `cargo_description` (TEXT) - Descripción carga
- `cargo_weight` (DECIMAL) - Peso en kg
- `origin` (VARCHAR) - Origen
- `destination` (VARCHAR) - Destino
- `status` (VARCHAR) - 'completed', 'cancelled', 'in_progress'

**Tabla relacionada:**
- `operation_photos` - Múltiples fotos por operación

---

### 6. **pre_operational_checklists**
Inspecciones pre-operacionales diarias.

**Campos principales:**
- `id` (UUID) - Identificador único
- `vehicle_plate` (VARCHAR) - FK a equipment
- `driver_name` (VARCHAR) - Conductor
- `check_date` (DATE) - Fecha inspección
- `tire_condition` (VARCHAR) - 'good', 'fair', 'poor', 'critical'
- `brake_condition` (VARCHAR) - Estado frenos
- `lights_condition` (VARCHAR) - Estado luces
- `fluid_levels` (VARCHAR) - Nivel fluidos
- `engine_condition` (VARCHAR) - Estado motor
- `vehicle_condition_assessment` (TEXT) - Evaluación general
- `condition_photo_path` (VARCHAR) - Foto condición
- `issues_found` (TEXT[]) - Array de problemas
- `passed` (BOOLEAN) - ¿Pasó inspección?
- `failure_reason` (TEXT) - Razón de falla si no pasó

---

### 7. **transport_requests**
Solicitudes de transporte de equipos.

**Campos principales:**
- `id` (UUID) - Identificador único
- `serial_number` (VARCHAR) - Serie equipo a transportar
- `brand/model` (VARCHAR) - Marca/modelo
- `weight/length/capacity` (DECIMAL) - Dimensiones
- `origin/destination` (VARCHAR) - Origen/destino
- `status` (VARCHAR) - 'pending', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled'
- `assigned_vehicle` (VARCHAR) - Vehículo asignado (FK)
- `assigned_driver` (VARCHAR) - Conductor asignado
- `requested_date` (DATE) - Fecha solicitud
- `preferred_pickup_date` (DATE) - Fecha recogida preferida
- `priority` (VARCHAR) - 'low', 'normal', 'high', 'urgent'
- `requested_by` (UUID) - Usuario solicitante (FK)
- `approved_by` (UUID) - Usuario aprobador (FK)
- `estimated_cost/actual_cost` (DECIMAL) - Costos

**Workflow:**
1. Usuario comercial crea solicitud → 'pending'
2. Admin/User revisa → 'approved' o 'rejected'
3. Se asigna vehículo/conductor → 'in_progress'
4. Operación completada → 'completed'

---

### 8. **holidays**
Días festivos para cálculo de horas.

**Campos:**
- `id` (UUID) - Identificador único
- `holiday_date` (DATE) - Fecha festivo (único)
- `holiday_name` (VARCHAR) - Nombre festivo
- `is_mandatory` (BOOLEAN) - Festivo obligatorio

**Pre-cargado con:**
- Festivos Colombia 2025 completos

---

### 9. **system_alerts**
Alertas del sistema.

**Campos:**
- `id` (UUID) - Identificador único
- `alert_type` (VARCHAR) - 'warning', 'error', 'info', 'success'
- `message` (TEXT) - Mensaje alerta
- `equipment_id` (UUID) - FK a equipment (opcional)
- `user_id` (UUID) - FK a usuario (opcional)
- `is_read` (BOOLEAN) - Leída
- `is_resolved` (BOOLEAN) - Resuelta

**Generación automática:**
- Documentos por vencer (<30 días) → warning
- Documentos vencidos → error
- Vehículos en mantenimiento >48h → warning

---

### 10. **audit_logs**
Registro de auditoría de cambios.

**Campos:**
- `id` (UUID) - Identificador único
- `table_name` (VARCHAR) - Tabla afectada
- `record_id` (UUID) - ID del registro
- `action` (VARCHAR) - 'INSERT', 'UPDATE', 'DELETE'
- `old_values` (JSONB) - Valores anteriores
- `new_values` (JSONB) - Valores nuevos
- `changed_by` (UUID) - Usuario que hizo cambio
- `changed_at` (TIMESTAMP) - Cuándo
- `ip_address` (INET) - IP origen

---

## 🔗 Relaciones

### Diagrama ER Simplificado

```
users (1) ──────── (N) equipment
  │                     │
  │                     ├── (N) operation_hours
  │                     ├── (N) fuel_logs
  │                     ├── (N) operations
  │                     ├── (N) pre_operational_checklists
  │                     ├── (N) transport_requests
  │                     ├── (N) equipment_documents
  │                     └── (N) system_alerts
  │
  └── (N) transport_requests
  └── (N) audit_logs

operations (1) ──── (N) operation_photos
```

---

## ⚙️ Funciones y Triggers

### 1. **update_updated_at_column()**
Actualiza automáticamente `updated_at` en cada UPDATE.

**Aplicado a:**
- users
- equipment
- operation_hours
- fuel_logs
- operations
- transport_requests

---

### 2. **calculate_operation_hours()**
Calcula automáticamente todas las horas al hacer checkout.

**Se ejecuta:**
- BEFORE INSERT OR UPDATE en `operation_hours`
- Solo si `check_out_time` no es NULL

**Calcula:**
- Horas totales
- Horas regulares según día de semana
- Horas extras
- Horas nocturnas con multiplicador 1.35
- Horas festivas con multiplicador 1.75
- Deducciones de desayuno/almuerzo

---

### 3. **generate_expiration_alerts()**
Genera alertas para documentos próximos a vencer.

**Ejecutar manualmente:**
```sql
SELECT generate_expiration_alerts();
```

**O programar con cron:**
```sql
-- Ejecutar diariamente a las 6:00 AM
SELECT cron.schedule('generate-alerts', '0 6 * * *', 
  'SELECT generate_expiration_alerts()');
```

---

### 4. **get_dashboard_metrics()**
Obtiene métricas agregadas para dashboard.

**Uso:**
```sql
SELECT * FROM get_dashboard_metrics();
```

**Retorna:**
- total_kilometers
- fuel_consumption
- active_vehicles
- expiring_documents_count

---

### 5. **verify_password()**
Verifica credenciales de usuario.

**Uso:**
```sql
SELECT * FROM verify_password('user@example.com', 'password');
```

---

### 6. **audit_changes()**
Registra automáticamente cambios en tablas críticas.

**Aplicado a:**
- equipment (INSERT, UPDATE, DELETE)
- transport_requests (INSERT, UPDATE, DELETE)

---

## 🚀 Instalación

### Windows (PowerShell)

```powershell
cd database
.\setup.ps1
```

### Linux/Mac (Bash)

```bash
cd database
chmod +x setup.sh
./setup.sh
```

### Manual

```bash
# 1. Crear base de datos
createdb transport_management

# 2. Ejecutar scripts en orden
psql -d transport_management -f schema.sql
psql -d transport_management -f functions.sql
psql -d transport_management -f seed.sql
```

---

## 📦 Datos de Prueba

El script `seed.sql` carga:

- ✅ 4 usuarios de prueba (admin, 2 users, 1 commercial)
- ✅ 6 vehículos de ejemplo
- ✅ 18 días festivos Colombia 2025
- ✅ 5 registros de horas operación
- ✅ 5 registros de combustible
- ✅ 5 operaciones de transporte
- ✅ 5 checklists pre-operacionales
- ✅ 5 solicitudes de transporte
- ✅ Alertas automáticas generadas

**Credenciales:**
```
Admin:      admin@partequipos.com / Password123!
Usuario:    user1@partequipos.com / Password123!
Comercial:  comercial@partequipos.com / Password123!
```

---

## 🔄 Migraciones

### Migraciones requeridas para módulos estándar

Para que Dashboard, Equipos, Horas de Operación, Combustible, Operaciones y Checklist funcionen correctamente en producción, ejecuta en Supabase (SQL Editor):

1. **`fix_checklists_department.sql`**  
   Añade la columna `department` a `pre_operational_checklists` y políticas RLS. Si no se ejecuta, el checklist intentará funcionar sin `department` (modo fallback).

2. **`alert_email_recipients_setup.sql`**  
   Crea la tabla `alert_email_recipients` para administrar los correos que reciben las alertas de vencimiento de documentos (Equipos). La app usa esta tabla desde el popover "Correos de alertas" en la página de Equipos; si no existe, se usan los destinatarios por defecto en la Edge Function.

### Crear nueva migración

```bash
# Crear archivo de migración
touch database/migrations/$(date +%Y%m%d%H%M%S)_descripcion.sql
```

### Aplicar migraciones

```sql
-- Ejemplo: Agregar columna a equipment
ALTER TABLE equipment ADD COLUMN maintenance_notes TEXT;

-- Registrar migración
INSERT INTO schema_migrations (version, name) 
VALUES ('20251104120000', 'add_maintenance_notes_to_equipment');
```

---

## 📈 Índices y Optimización

### Índices Principales

```sql
-- Búsquedas por placa (muy frecuente)
CREATE INDEX idx_equipment_license_plate ON equipment(license_plate);
CREATE INDEX idx_operation_hours_vehicle ON operation_hours(vehicle_plate);
CREATE INDEX idx_fuel_logs_vehicle ON fuel_logs(vehicle_plate);

-- Búsquedas por fecha (reportes)
CREATE INDEX idx_operation_hours_dates ON operation_hours(check_in_time, check_out_time);
CREATE INDEX idx_fuel_logs_date ON fuel_logs(fuel_date);

-- Filtros por estado
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_transport_requests_status ON transport_requests(status);

-- Alertas no leídas (dashboard)
CREATE INDEX idx_system_alerts_unread ON system_alerts(is_read) WHERE is_read = false;
```

### Mantenimiento

```sql
-- Vacuuming regular
VACUUM ANALYZE;

-- Reindexar si es necesario
REINDEX DATABASE transport_management;

-- Ver tamaño de tablas
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📞 Soporte

Para dudas sobre la base de datos:
- Revisar este README
- Consultar comentarios en `schema.sql`
- Revisar funciones en `functions.sql`

---

**Última actualización:** Noviembre 2025

