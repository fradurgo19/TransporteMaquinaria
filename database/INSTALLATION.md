# 🚀 Guía de Instalación - Base de Datos

Esta guía te llevará paso a paso por la configuración de la base de datos local PostgreSQL.

## 📋 Pre-requisitos

### 1. PostgreSQL 14+

**Windows:**
- Descargar de: https://www.postgresql.org/download/windows/
- O usar el instalador EDB: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- Durante la instalación, recordar la contraseña del usuario `postgres`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

### 2. Verificar Instalación

```bash
# Verificar versión
psql --version

# Debería mostrar: psql (PostgreSQL) 14.x o superior

# Verificar que el servicio está corriendo
# Windows: Buscar "Services" y verificar "postgresql-x64-14"
# Linux/Mac:
sudo systemctl status postgresql
```

---

## 🛠️ Instalación Paso a Paso

### Opción A: Script Automático (Recomendado)

#### Windows (PowerShell)

1. **Abrir PowerShell como Administrador**

2. **Navegar al directorio del proyecto:**
   ```powershell
   cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"
   ```

3. **Ejecutar el script:**
   ```powershell
   .\database\setup.ps1
   ```

4. **Seguir las instrucciones:**
   - Ingresar contraseña de PostgreSQL
   - Confirmar si desea eliminar DB existente (si aplica)
   - Confirmar si desea cargar datos de prueba (recomendado: S)
   - Confirmar si desea crear/sobrescribir .env

5. **¡Listo!** La base de datos está configurada.

#### Linux/Mac (Bash)

1. **Abrir terminal**

2. **Navegar al directorio:**
   ```bash
   cd /path/to/project
   ```

3. **Dar permisos de ejecución:**
   ```bash
   chmod +x database/setup.sh
   ```

4. **Ejecutar el script:**
   ```bash
   ./database/setup.sh
   ```

5. **Seguir las instrucciones** (igual que Windows)

---

### Opción B: Instalación Manual

Si prefieres control total o el script automático falla:

#### 1. Crear la Base de Datos

```bash
# Conectar a PostgreSQL como superusuario
psql -U postgres

# Dentro de psql:
CREATE DATABASE transport_management;

# Salir
\q
```

#### 2. Ejecutar Esquema

```bash
psql -U postgres -d transport_management -f database/schema.sql
```

Esto creará:
- ✅ 10 tablas principales
- ✅ Índices de optimización
- ✅ Constraints y validaciones
- ✅ Extensiones (uuid-ossp, pgcrypto)

#### 3. Ejecutar Funciones y Triggers

```bash
psql -U postgres -d transport_management -f database/functions.sql
```

Esto creará:
- ✅ 6 funciones de negocio
- ✅ Triggers automáticos
- ✅ Cálculo de horas automático
- ✅ Generación de alertas
- ✅ Auditoría de cambios

#### 4. Cargar Datos de Prueba (Opcional pero Recomendado)

```bash
psql -U postgres -d transport_management -f database/seed.sql
```

Esto cargará:
- ✅ 4 usuarios de prueba
- ✅ 6 vehículos de ejemplo
- ✅ 18 días festivos Colombia 2025
- ✅ Datos operativos de ejemplo

#### 5. Crear Archivo de Variables de Entorno

```bash
# Copiar el template
cp env.template .env

# Editar con tu editor favorito
nano .env
# o
code .env
```

Completar los valores:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transport_management
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_AQUÍ
```

#### 6. Crear Directorios de Uploads

```bash
mkdir -p uploads/receipts
mkdir -p uploads/operations
mkdir -p uploads/checklists
mkdir -p uploads/documents
```

---

## ✅ Verificación de Instalación

### 1. Verificar Tablas Creadas

```bash
psql -U postgres -d transport_management -c "\dt"
```

Deberías ver 10+ tablas:
```
                    List of relations
 Schema |            Name            | Type  |  Owner
--------+----------------------------+-------+----------
 public | audit_logs                 | table | postgres
 public | equipment                  | table | postgres
 public | equipment_documents        | table | postgres
 public | fuel_logs                  | table | postgres
 public | holidays                   | table | postgres
 public | operation_hours            | table | postgres
 public | operation_photos           | table | postgres
 public | operations                 | table | postgres
 public | pre_operational_checklists | table | postgres
 public | system_alerts              | table | postgres
 public | transport_requests         | table | postgres
 public | users                      | table | postgres
```

### 2. Verificar Datos de Prueba

```bash
# Verificar usuarios
psql -U postgres -d transport_management -c "SELECT username, email, role FROM users;"
```

Deberías ver:
```
 username  |           email           |   role
-----------+---------------------------+------------
 admin     | admin@partequipos.com     | admin
 user1     | user1@partequipos.com     | user
 comercial | comercial@partequipos.com | commercial
 user2     | user2@partequipos.com     | user
```

### 3. Probar Función de Métricas

```bash
psql -U postgres -d transport_management -c "SELECT * FROM get_dashboard_metrics();"
```

Deberías ver métricas agregadas:
```
 total_kilometers | fuel_consumption | active_vehicles | expiring_documents_count
------------------+------------------+-----------------+--------------------------
             2550 |            224.0 |               5 |                        3
```

### 4. Verificar Alertas Generadas

```bash
psql -U postgres -d transport_management -c "SELECT alert_type, message FROM system_alerts LIMIT 5;"
```

Deberías ver alertas de documentos por vencer.

---

## 🔧 Resolución de Problemas

### Problema: "psql: error: connection to server failed"

**Causa:** PostgreSQL no está corriendo.

**Solución:**
```bash
# Windows: Iniciar servicio en Services.msc
# Linux:
sudo systemctl start postgresql

# Mac:
brew services start postgresql@14
```

---

### Problema: "FATAL: password authentication failed"

**Causa:** Contraseña incorrecta.

**Solución:**
```bash
# Resetear contraseña de postgres (Linux/Mac)
sudo -u postgres psql
ALTER USER postgres PASSWORD 'nueva_contraseña';
\q

# Windows: Reinstalar PostgreSQL o usar pgAdmin
```

---

### Problema: "ERROR: database already exists"

**Causa:** La base de datos ya fue creada anteriormente.

**Solución:**
```bash
# Eliminar y recrear
psql -U postgres -c "DROP DATABASE transport_management;"
psql -U postgres -c "CREATE DATABASE transport_management;"

# Luego continuar con los scripts
```

---

### Problema: "ERROR: could not open file schema.sql"

**Causa:** El script no encuentra el archivo.

**Solución:**
```bash
# Asegúrate de estar en el directorio correcto
cd /ruta/al/proyecto

# Verificar que los archivos existen
ls -la database/

# Ejecutar con ruta completa
psql -U postgres -d transport_management -f "$(pwd)/database/schema.sql"
```

---

### Problema: Script setup.ps1 no ejecuta (Windows)

**Causa:** Política de ejecución de PowerShell.

**Solución:**
```powershell
# Permitir ejecución temporal (solo sesión actual)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Luego ejecutar el script
.\database\setup.ps1
```

---

### Problema: "ERROR: extension uuid-ossp already exists"

**Causa:** Extensión ya instalada.

**Solución:**
Ignorar este error, es benigno. El script continúa normalmente.

---

## 🔐 Credenciales de Prueba

Después de la instalación con datos de prueba:

| Rol | Email | Contraseña | Permisos |
|-----|-------|------------|----------|
| **Admin** | admin@partequipos.com | Password123! | CRUD completo |
| **Usuario** | user1@partequipos.com | Password123! | Operaciones |
| **Comercial** | comercial@partequipos.com | Password123! | Solicitudes |

⚠️ **IMPORTANTE:** Cambiar estas contraseñas antes de producción.

---

## 📊 Próximos Pasos

Una vez instalada la base de datos:

1. ✅ **Instalar dependencias del frontend:**
   ```bash
   npm install
   ```

2. ✅ **Verificar archivo .env:**
   ```bash
   cat .env
   ```

3. ✅ **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. ✅ **Acceder a la aplicación:**
   ```
   http://localhost:5173
   ```

5. ✅ **Iniciar sesión con credenciales de prueba**

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa la sección "Resolución de Problemas" arriba
2. Consulta `database/README.md` para detalles técnicos
3. Revisa los logs de PostgreSQL:
   - Windows: `C:\Program Files\PostgreSQL\14\data\log\`
   - Linux: `/var/log/postgresql/`
   - Mac: `/usr/local/var/log/`

---

## 🔄 Actualizaciones Futuras

Para aplicar cambios al esquema en el futuro:

```bash
# Crear nueva migración
touch database/migrations/$(date +%Y%m%d%H%M%S)_descripcion.sql

# Aplicar migración
psql -U postgres -d transport_management -f database/migrations/XXXXX_descripcion.sql
```

---

**¡Felicidades! Tu base de datos está lista para desarrollo. 🎉**

