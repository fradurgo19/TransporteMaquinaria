# ============================================
# SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
# Sistema de Gestión de Transporte - Windows
# PowerShell Script
# ============================================

Write-Host "============================================" -ForegroundColor Green
Write-Host "CONFIGURACIÓN DE BASE DE DATOS" -ForegroundColor Green
Write-Host "Sistema de Gestión de Transporte" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Configuración de PostgreSQL local
$DB_NAME = "transport_management"
$DB_USER = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Solicitar contraseña
Write-Host "Ingrese la contraseña de PostgreSQL:" -ForegroundColor Yellow
$DB_PASSWORD = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
$DB_PASSWORD_PLAIN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:PGPASSWORD = $DB_PASSWORD_PLAIN

Write-Host ""
Write-Host "Verificando conexión a PostgreSQL..." -ForegroundColor Yellow

# Verificar si PostgreSQL está corriendo
try {
    $null = & pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL no responde"
    }
    Write-Host "✓ PostgreSQL está corriendo" -ForegroundColor Green
} catch {
    Write-Host "Error: PostgreSQL no está corriendo en ${DB_HOST}:${DB_PORT}" -ForegroundColor Red
    Write-Host "Por favor, inicie PostgreSQL e intente de nuevo." -ForegroundColor Yellow
    exit 1
}

# Verificar si la base de datos ya existe
$dbExists = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>&1 | Select-String -Pattern $DB_NAME -Quiet

if ($dbExists) {
    Write-Host ""
    Write-Host "La base de datos '$DB_NAME' ya existe." -ForegroundColor Yellow
    $response = Read-Host "¿Desea eliminarla y recrearla? (s/N)"
    if ($response -match '^[sS]') {
        Write-Host "Eliminando base de datos existente..." -ForegroundColor Yellow
        & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | Out-Null
        Write-Host "✓ Base de datos eliminada" -ForegroundColor Green
    } else {
        Write-Host "Cancelando operación..." -ForegroundColor Yellow
        exit 0
    }
}

# Crear base de datos
Write-Host ""
Write-Host "Creando base de datos '$DB_NAME'..." -ForegroundColor Yellow
& psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Base de datos creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "Error al crear la base de datos" -ForegroundColor Red
    exit 1
}

# Ejecutar schema.sql
Write-Host ""
Write-Host "Creando esquema de base de datos..." -ForegroundColor Yellow
$schemaPath = Join-Path $PSScriptRoot "schema.sql"
& psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $schemaPath 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Esquema creado exitosamente" -ForegroundColor Green
} else {
    Write-Host "Error al crear el esquema" -ForegroundColor Red
    exit 1
}

# Ejecutar functions.sql
Write-Host ""
Write-Host "Creando funciones y triggers..." -ForegroundColor Yellow
$functionsPath = Join-Path $PSScriptRoot "functions.sql"
& psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $functionsPath 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Funciones y triggers creados exitosamente" -ForegroundColor Green
} else {
    Write-Host "Error al crear funciones y triggers" -ForegroundColor Red
    exit 1
}

# Preguntar si desea cargar datos de prueba
Write-Host ""
$response = Read-Host "¿Desea cargar datos de prueba? (S/n)"
if ($response -notmatch '^[nN]') {
    Write-Host "Cargando datos de prueba..." -ForegroundColor Yellow
    $seedPath = Join-Path $PSScriptRoot "seed.sql"
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $seedPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Datos de prueba cargados exitosamente" -ForegroundColor Green
    } else {
        Write-Host "Error al cargar datos de prueba" -ForegroundColor Red
        exit 1
    }
}

# Crear archivo .env si no existe
Write-Host ""
Write-Host "Configurando variables de entorno..." -ForegroundColor Yellow

$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"

if (Test-Path $envPath) {
    $response = Read-Host "El archivo .env ya existe. ¿Desea sobrescribirlo? (s/N)"
    if ($response -notmatch '^[sS]') {
        Write-Host "Manteniendo archivo .env existente" -ForegroundColor Yellow
        $envPath = $null
    }
}

if ($envPath) {
    $envContent = @"
# Database Configuration (Local Development)
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD_PLAIN

# Supabase Configuration (Production - A configurar luego)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_ROLE_KEY=

# Application Configuration
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development

# File Upload Configuration
VITE_MAX_FILE_SIZE=10485760
VITE_UPLOAD_PATH=./uploads

# Session Configuration
VITE_SESSION_TIMEOUT=3600000
"@

    Set-Content -Path $envPath -Value $envContent
    Write-Host "✓ Archivo .env creado en: $envPath" -ForegroundColor Green
}

# Crear directorio de uploads
$uploadDir = Join-Path (Split-Path $PSScriptRoot -Parent) "uploads"
$null = New-Item -Path $uploadDir -ItemType Directory -Force
$null = New-Item -Path (Join-Path $uploadDir "receipts") -ItemType Directory -Force
$null = New-Item -Path (Join-Path $uploadDir "operations") -ItemType Directory -Force
$null = New-Item -Path (Join-Path $uploadDir "checklists") -ItemType Directory -Force
$null = New-Item -Path (Join-Path $uploadDir "documents") -ItemType Directory -Force

Write-Host "✓ Directorios de uploads creados" -ForegroundColor Green

# Resumen
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "CONFIGURACIÓN COMPLETADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Base de datos: " -NoNewline -ForegroundColor Green
Write-Host $DB_NAME
Write-Host "Host: " -NoNewline -ForegroundColor Green
Write-Host "${DB_HOST}:${DB_PORT}"
Write-Host "Usuario: " -NoNewline -ForegroundColor Green
Write-Host $DB_USER
Write-Host ""
Write-Host "Credenciales de prueba:" -ForegroundColor Yellow
Write-Host "  Admin:      admin@partequipos.com / Password123!"
Write-Host "  Usuario:    user1@partequipos.com / Password123!"
Write-Host "  Comercial:  comercial@partequipos.com / Password123!"
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Revise el archivo .env y ajuste según sea necesario"
Write-Host "  2. Instale las dependencias del proyecto: npm install"
Write-Host "  3. Inicie el servidor de desarrollo: npm run dev"
Write-Host ""
Write-Host "¡Listo para comenzar el desarrollo!" -ForegroundColor Green
Write-Host ""

# Limpiar contraseña de la memoria
$env:PGPASSWORD = $null

