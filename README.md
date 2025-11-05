# 🚛 Sistema de Gestión de Transporte de Maquinaria

Aplicación web completa para gestión de transporte de equipos pesados construida con React, TypeScript y PostgreSQL/Supabase.

**Desarrollado para:** Partequipos S.A.S  
**Desarrollador:** Frank Anderson Duran Gonzalez  
**Fecha:** Noviembre 2025

---

## ⚡ Quick Start

**¿Primera vez aquí?** Lee: [QUICKSTART.md](QUICKSTART.md) (5 minutos)

**Setup completo de base de datos:**
```powershell
# Windows PowerShell (Administrador)
.\database\setup.ps1
```

**Iniciar desarrollo:**
```bash
npm install
npm run dev
```

**Documentación completa:**
- 📖 [Setup Completo](SETUP_COMPLETE.md) - Estado actual y próximos pasos
- 📖 [Guía de Instalación](database/INSTALLATION.md) - Paso a paso detallado
- 📖 [Plan de Desarrollo](database/NEXT_STEPS.md) - Roadmap modular
- 📖 [Documentación de BD](database/README.md) - Esquema técnico

---

## 🎯 Estado del Proyecto

### ✅ Completado (55%)
- ✅ Stack tecnológico completo configurado
- ✅ Estructura Atomic Design implementada
- ✅ Base de datos PostgreSQL con 12 tablas
- ✅ Funciones automáticas (cálculo horas extras, alertas)
- ✅ Scripts de instalación Windows/Linux/Mac
- ✅ Datos de prueba listos
- ✅ Documentación completa

### ⏳ En Desarrollo (45%)
- ⏳ Conexión real a base de datos local
- ⏳ CRUD completo de todos los módulos
- ⏳ Testing (unit + integration + E2E)
- ⏳ Migración a Supabase (producción)
- ⏳ Deploy a Vercel

---

## Features

### Authentication System
- Role-based access control (Admin, User, Commercial)
- Protected routes with automatic redirects
- Session management

### Dashboard
- Real-time metrics display
- Vehicle status overview
- Alert system for expiring documents
- Responsive card-based layout

### Equipment Management
- Full CRUD operations (Admin only)
- Read-only access for Users
- Track vehicle information, documents, and expiration dates
- GPS location tracking
- Document attachment management

### Operation Hours Tracking
- Automatic overtime calculations
- Multiple shift schedules support
- Breakfast and lunch deductions
- Night shift multipliers (1.35x)
- Holiday multipliers (1.75x)
- Real-time hour logging

### Fuel Management
- Fuel consumption tracking
- Receipt photo upload
- Odometer readings
- Cost tracking
- Distance calculations

### Operations Tracking
- Loading status updates
- Route start tracking
- Delivery confirmations
- GPS location capture
- Photo documentation

### Pre-operational Checklist
- Daily vehicle condition reporting
- Photo documentation
- Issue tracking

### Transport Requests
- Request management system
- Status tracking
- Available to all user roles

## Technology Stack

- **React 18+** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router v6** - Client-side routing
- **TanStack Query** - Server state management
- **Supabase** - Backend and authentication
- **TailwindCSS** - Styling
- **Lucide React** - Icons
- **date-fns** - Date utilities

## Project Structure

```
src/
├── atoms/          # Basic UI components (buttons, inputs, cards)
├── molecules/      # Composite components (forms, search bars)
├── organisms/      # Complex components (tables, navigation)
├── templates/      # Page layouts
├── pages/          # Route components
├── hooks/          # Custom React hooks
├── services/       # API integration and utilities
├── types/          # TypeScript definitions
└── context/        # Global state providers
```

## 🚀 Getting Started

### Prerequisites

- ✅ **PostgreSQL 14+** - Para desarrollo local
- ✅ **Node.js 18+** - Runtime JavaScript
- ✅ **npm o yarn** - Gestor de paquetes
- ⏳ **Supabase account** - Solo para producción (más adelante)

### Instalación Rápida

#### 1. Setup de Base de Datos

**Windows:**
```powershell
# PowerShell como Administrador
cd "ruta\al\proyecto"
.\database\setup.ps1
```

**Linux/Mac:**
```bash
cd /ruta/al/proyecto
chmod +x database/setup.sh
./database/setup.sh
```

**Resultado:**
- Base de datos `transport_management` creada
- 12 tablas con datos de prueba
- 4 usuarios de prueba creados
- Archivo `.env` configurado
- Directorios `uploads/` listos

#### 2. Instalar Dependencias

```bash
npm install
```

#### 3. Iniciar Desarrollo

```bash
npm run dev
```

**Aplicación disponible en:** http://localhost:5173

#### 4. Login de Prueba

| Usuario | Email | Password | Rol |
|---------|-------|----------|-----|
| Admin | admin@partequipos.com | Password123! | admin |
| Usuario | user1@partequipos.com | Password123! | user |
| Comercial | comercial@partequipos.com | Password123! | commercial |

### Build para Producción

```bash
npm run build
npm run preview
```

## 🗄️ Database Setup

### Desarrollo Local (PostgreSQL)

La aplicación usa PostgreSQL localmente para desarrollo.

**Scripts disponibles:**
```bash
database/
├── schema.sql      - Esquema completo (12 tablas)
├── functions.sql   - 6 funciones + triggers
├── seed.sql        - Datos de prueba
├── setup.sh        - Instalación Linux/Mac
└── setup.ps1       - Instalación Windows
```

**Tablas principales:**
- `users` - Usuarios y autenticación
- `equipment` - Vehículos y equipos
- `equipment_documents` - Documentos adjuntos
- `operation_hours` - Horas de operación (cálculo automático)
- `fuel_logs` - Consumo de combustible
- `operations` - Tracking de operaciones
- `operation_photos` - Fotos de operaciones
- `pre_operational_checklists` - Inspecciones diarias
- `transport_requests` - Solicitudes de transporte
- `holidays` - Días festivos
- `system_alerts` - Alertas automáticas
- `audit_logs` - Auditoría de cambios

**Documentación completa:** Ver [database/README.md](database/README.md)

### Producción (Supabase)

Migración a Supabase planificada para Fase 6 (después de completar todos los módulos).

## Key Features Implementation

### Overtime Calculation Rules

The system automatically calculates overtime based on these schedules:

- **Monday-Thursday**: 8:00-17:30 (9.5 hours)
- **Friday**: 8:00-16:00 (8 hours)
- **Saturday**: 9:00-12:00 (3 hours)
- **Night overtime**: 21:00-06:00 (1.35x multiplier)
- **Holiday hours**: 1.75x multiplier
- **Sundays**: 2 hours deduction (breakfast and lunch)

### Breakfast Deductions

- Check-in before 6:00 AM: 1 hour deduction
- Check-in at 6:00 AM: 1 hour deduction
- Check-in after 7:00 AM: Standard checkout at 5:00 PM

### GPS Integration

The application uses the browser's Geolocation API to automatically capture GPS coordinates for:
- Operation hour logging
- Fuel entries
- Operation status updates
- Pre-operational checklists

### Photo Management

Photo upload and compression is handled for:
- Fuel receipts
- Operation documentation
- Vehicle condition reports

Images are automatically compressed before upload for optimal performance.

## Code Quality

- Comprehensive TypeScript typing
- Component memoization for performance
- Error boundaries and error handling
- Loading states with skeleton UI
- Responsive design for all screen sizes
- Accessibility compliance (WCAG 2.1)

## Performance Optimizations

- React.memo for expensive components
- React Query for efficient data caching
- Lazy loading for routes
- Image compression and progressive loading
- Bundle splitting

## User Roles and Permissions

### Admin
- Full CRUD access to equipment
- Access to all features
- User management

### User
- Read-only equipment access
- Full access to operational features
- Can log hours, fuel, operations

### Commercial
- Access to transport requests
- Limited operational access

## Contributing

This is a production-ready application. Follow these guidelines:

1. Use conventional commit messages
2. Write unit tests for new features
3. Ensure all builds pass before committing
4. Follow the existing code structure and patterns

## License

Proprietary - All rights reserved
