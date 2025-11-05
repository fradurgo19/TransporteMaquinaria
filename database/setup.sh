#!/bin/bash

# ============================================
# SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
# Sistema de Gestión de Transporte
# ============================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}CONFIGURACIÓN DE BASE DE DATOS${NC}"
echo -e "${GREEN}Sistema de Gestión de Transporte${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Configuración de PostgreSQL local
DB_NAME="transport_management"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Solicitar contraseña si no está configurada
if [ -z "$PGPASSWORD" ]; then
    echo -e "${YELLOW}Ingrese la contraseña de PostgreSQL:${NC}"
    read -s DB_PASSWORD
    export PGPASSWORD=$DB_PASSWORD
fi

echo ""
echo -e "${YELLOW}Verificando conexión a PostgreSQL...${NC}"

# Verificar si PostgreSQL está corriendo
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo -e "${RED}Error: PostgreSQL no está corriendo en $DB_HOST:$DB_PORT${NC}"
    echo -e "${YELLOW}Por favor, inicie PostgreSQL e intente de nuevo.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL está corriendo${NC}"

# Verificar si la base de datos ya existe
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo ""
    echo -e "${YELLOW}La base de datos '$DB_NAME' ya existe.${NC}"
    echo -e "${YELLOW}¿Desea eliminarla y recrearla? (s/N):${NC}"
    read -r response
    if [[ "$response" =~ ^([sS][iI]|[sS])$ ]]; then
        echo -e "${YELLOW}Eliminando base de datos existente...${NC}"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
        echo -e "${GREEN}✓ Base de datos eliminada${NC}"
    else
        echo -e "${YELLOW}Cancelando operación...${NC}"
        exit 0
    fi
fi

# Crear base de datos
echo ""
echo -e "${YELLOW}Creando base de datos '$DB_NAME'...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Base de datos creada exitosamente${NC}"
else
    echo -e "${RED}Error al crear la base de datos${NC}"
    exit 1
fi

# Ejecutar schema.sql
echo ""
echo -e "${YELLOW}Creando esquema de base de datos...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/schema.sql" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Esquema creado exitosamente${NC}"
else
    echo -e "${RED}Error al crear el esquema${NC}"
    exit 1
fi

# Ejecutar functions.sql
echo ""
echo -e "${YELLOW}Creando funciones y triggers...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/functions.sql" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Funciones y triggers creados exitosamente${NC}"
else
    echo -e "${RED}Error al crear funciones y triggers${NC}"
    exit 1
fi

# Preguntar si desea cargar datos de prueba
echo ""
echo -e "${YELLOW}¿Desea cargar datos de prueba? (S/n):${NC}"
read -r response
if [[ ! "$response" =~ ^([nN][oO]|[nN])$ ]]; then
    echo -e "${YELLOW}Cargando datos de prueba...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/seed.sql"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Datos de prueba cargados exitosamente${NC}"
    else
        echo -e "${RED}Error al cargar datos de prueba${NC}"
        exit 1
    fi
fi

# Crear archivo .env si no existe
echo ""
echo -e "${YELLOW}Configurando variables de entorno...${NC}"

ENV_FILE="$(dirname "$0")/../.env"

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}El archivo .env ya existe. ¿Desea sobrescribirlo? (s/N):${NC}"
    read -r response
    if [[ ! "$response" =~ ^([sS][iI]|[sS])$ ]]; then
        echo -e "${YELLOW}Manteniendo archivo .env existente${NC}"
        ENV_FILE=""
    fi
fi

if [ -n "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
# Database Configuration (Local Development)
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

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
EOF

    echo -e "${GREEN}✓ Archivo .env creado en: $ENV_FILE${NC}"
fi

# Crear directorio de uploads
UPLOAD_DIR="$(dirname "$0")/../uploads"
mkdir -p "$UPLOAD_DIR/receipts"
mkdir -p "$UPLOAD_DIR/operations"
mkdir -p "$UPLOAD_DIR/checklists"
mkdir -p "$UPLOAD_DIR/documents"

echo -e "${GREEN}✓ Directorios de uploads creados${NC}"

# Resumen
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}CONFIGURACIÓN COMPLETADA EXITOSAMENTE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${GREEN}Base de datos:${NC} $DB_NAME"
echo -e "${GREEN}Host:${NC} $DB_HOST:$DB_PORT"
echo -e "${GREEN}Usuario:${NC} $DB_USER"
echo ""
echo -e "${YELLOW}Credenciales de prueba:${NC}"
echo -e "  Admin:      admin@partequipos.com / Password123!"
echo -e "  Usuario:    user1@partequipos.com / Password123!"
echo -e "  Comercial:  comercial@partequipos.com / Password123!"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo -e "  1. Revise el archivo .env y ajuste según sea necesario"
echo -e "  2. Instale las dependencias del proyecto: npm install"
echo -e "  3. Inicie el servidor de desarrollo: npm run dev"
echo ""
echo -e "${GREEN}¡Listo para comenzar el desarrollo!${NC}"
echo ""

