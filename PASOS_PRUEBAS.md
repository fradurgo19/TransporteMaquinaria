# Pasos para Ejecutar Pruebas

## 📍 Ubicación de Carpetas

**Ruta del proyecto:**
```
C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project
```

---

## 🎨 Pruebas Unitarias Frontend

**📍 Ejecutar en:** Carpeta raíz del proyecto (`project\`)

```powershell
# Abrir terminal en la carpeta raíz del proyecto
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"

# Ejecutar pruebas en modo watch
npm run test

# Ejecutar pruebas con UI interactiva
npm run test:ui

# Ejecutar pruebas una vez
npm run test:run

# Ejecutar pruebas con cobertura
npm run test:coverage
```

---

## 🌐 Pruebas E2E (Playwright)

**📍 Ejecutar en:** Carpeta raíz del proyecto (`project\`)

```powershell
# Abrir terminal en la carpeta raíz del proyecto
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"

# Ejecutar todas las pruebas E2E
npm run test:e2e

# Ejecutar pruebas E2E con UI interactiva
npm run test:e2e:ui

# Ejecutar pruebas en modo headed (ver navegador)
npm run test:e2e:headed

# Ver reportes HTML (después de ejecutar pruebas)
npm run test:e2e:report

# Generar y abrir reporte Allure (después de ejecutar pruebas)
npm run test:e2e:allure
```

---

## 🔌 Pruebas API Backend

**📍 Ejecutar en:** Carpeta `backend` (`project\backend\`)

```powershell
# Abrir terminal y navegar a la carpeta backend
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project\backend"

# Ejecutar pruebas en modo watch
npm run test

# Ejecutar pruebas con UI interactiva
npm run test:ui

# Ejecutar pruebas una vez
npm run test:run

# Ejecutar pruebas con cobertura
npm run test:coverage
```

---

## 🚀 Ejecutar Todas las Pruebas (Frontend)

**📍 Ejecutar en:** Carpeta raíz del proyecto (`project\`)

```powershell
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"

# Ejecuta unitarias + E2E
npm run test:all
```

---

## 📝 Resumen Rápido

| Tipo de Prueba | Carpeta | Comando Principal |
|----------------|---------|-------------------|
| Unitarias Frontend | `project\` | `npm run test` |
| E2E Frontend | `project\` | `npm run test:e2e` |
| API Backend | `project\backend\` | `npm run test` |

---

## 💡 Notas

- **Primera vez:** Ejecuta `npm install` en cada carpeta si no lo has hecho
- **Playwright:** La primera vez puede tardar en descargar navegadores
- **Reportes:** Se generan en carpetas `coverage/`, `playwright-report/`, `allure-results/`
