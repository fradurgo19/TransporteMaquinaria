# ⚡ QUICK START - 5 Minutos para Comenzar

## 🎯 Objetivo
Tener la base de datos funcionando y lista para desarrollo en menos de 5 minutos.

---

## ✅ Pre-requisitos Rápidos

- ✅ PostgreSQL instalado y corriendo
- ✅ Node.js instalado
- ✅ Este proyecto descargado

---

## 🚀 3 Pasos para Comenzar

### 1️⃣ Setup de Base de Datos (2 minutos)

**Windows PowerShell (Administrador):**
```powershell
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"
.\database\setup.ps1
```

**Ingresar cuando pida:**
- Contraseña de PostgreSQL
- Confirmar cargar datos de prueba: `S`
- Confirmar crear .env: `S`

**✅ Listo:** Base de datos creada con datos de prueba

---

### 2️⃣ Instalar Dependencias (1 minuto)

```powershell
npm install
```

---

### 3️⃣ Iniciar Aplicación (30 segundos)

```powershell
npm run dev
```

**Abrir navegador:** http://localhost:5173

---

## 🔐 Login de Prueba

**Administrador:**
- Email: `admin@partequipos.com`
- Password: `Password123!`

**Usuario:**
- Email: `user1@partequipos.com`
- Password: `Password123!`

---

## ✅ Verificación Rápida

### Base de Datos OK?
```powershell
psql -U postgres -d transport_management -c "SELECT COUNT(*) FROM users;"
```
Debe mostrar: `count = 4`

### Frontend OK?
Abrir http://localhost:5173 - Debe mostrar página de login

---

## 📂 Estructura Rápida

```
project/
├── database/          ← Scripts SQL (YA LISTOS)
├── src/
│   ├── atoms/         ← Componentes básicos
│   ├── molecules/     ← Componentes compuestos
│   ├── organisms/     ← Componentes complejos
│   ├── pages/         ← Páginas (8 módulos)
│   ├── hooks/         ← Custom hooks
│   ├── services/      ← Servicios API
│   └── context/       ← Estado global
├── uploads/           ← Archivos subidos (local)
└── .env              ← Variables (creado por setup)
```

---

## 🎯 ¿Qué Tengo Ahora?

Después del setup:

- ✅ Base de datos PostgreSQL con 12 tablas
- ✅ 4 usuarios de prueba
- ✅ 6 vehículos de ejemplo
- ✅ Datos operativos simulados
- ✅ Funciones automáticas (cálculo horas, alertas)
- ✅ Frontend corriendo en React

---

## 🔜 Próximo Paso

El frontend actual muestra **datos mock** (estáticos).

**Siguiente tarea:** Conectar frontend con PostgreSQL para mostrar datos reales.

Ver plan completo en: `database/NEXT_STEPS.md`

---

## ❌ Problemas Comunes

### "psql: command not found"
PostgreSQL no está en PATH. Agregar a variables de entorno.

### "password authentication failed"
Contraseña incorrecta. Verificar en pgAdmin.

### "port 5432 already in use"
PostgreSQL ya está corriendo. Eso es bueno, continuar.

### "npm: command not found"
Node.js no instalado. Descargar de nodejs.org

---

## 📖 Documentación Completa

- **Instalación detallada:** `database/INSTALLATION.md`
- **Documentación técnica BD:** `database/README.md`
- **Plan de desarrollo:** `database/NEXT_STEPS.md`
- **Resumen completo:** `SETUP_COMPLETE.md`

---

## 💬 Siguiente Conversación

Una vez completado el setup, dime:
**"Setup exitoso, continuemos con [módulo que prefieras]"**

Opciones:
- Autenticación real
- Dashboard con datos reales
- Equipment Management CRUD

---

**¡A programar! 🚀**

