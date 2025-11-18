# 🚀 Guía de Setup para Supabase

Esta guía te llevará paso a paso para crear un proyecto en Supabase y configurar la base de datos completa.

## 📋 Paso 1: Crear Proyecto en Supabase

1. **Ir a Supabase:**
   - Abre tu navegador y ve a: https://app.supabase.com
   - Inicia sesión o crea una cuenta gratuita

2. **Crear Nuevo Proyecto:**
   - Haz clic en el botón **"New Project"** o **"Create a new project"**
   - Completa el formulario:
     - **Name:** `TransporteMaquinaria` (o el nombre que prefieras)
     - **Database Password:** Crea una contraseña segura (¡GUÁRDALA EN UN LUGAR SEGURO!)
     - **Region:** Selecciona la región más cercana (ej: `South America (São Paulo)`)
     - **Pricing Plan:** Free (para empezar)

3. **Esperar Creación:**
   - El proyecto tarda 2-3 minutos en crearse
   - Verás un mensaje de "Setting up your project..."

## 📋 Paso 2: Obtener Credenciales

Una vez creado el proyecto:

1. **Ir a Settings:**
   - En el menú lateral, haz clic en **"Settings"** (⚙️)
   - Luego haz clic en **"API"**

2. **Copiar Credenciales:**
   - **Project URL:** Copia la URL (ejemplo: `https://xxxxx.supabase.co`)
   - **anon public key:** Copia la clave que empieza con `eyJ...` (es muy larga)

3. **Guardar las Credenciales:**
   - Las necesitarás para el archivo `.env`

## 📋 Paso 3: Ejecutar Script SQL

1. **Abrir SQL Editor:**
   - En el menú lateral, haz clic en **"SQL Editor"**
   - Haz clic en **"New query"**

2. **Copiar y Ejecutar Script:**
   - Abre el archivo `database/supabase_setup.sql` en tu editor
   - Copia TODO el contenido del archivo
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **"Run"** o presiona `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

3. **Verificar Ejecución:**
   - Deberías ver un mensaje de éxito
   - Si hay errores, revisa la consola de Supabase

## 📋 Paso 4: Crear Usuarios en Authentication

1. **Ir a Authentication:**
   - En el menú lateral, haz clic en **"Authentication"**
   - Luego haz clic en **"Users"**

2. **Crear Usuario Admin:**
   - Haz clic en **"Add user"** → **"Create new user"**
   - Completa:
     - **Email:** `admin@partequipos.com`
     - **Password:** `Password123!`
     - **Auto Confirm User:** ✅ (marcar)
   - Haz clic en **"Create user"**

3. **Actualizar Rol del Usuario:**
   - Ve a **"SQL Editor"** nuevamente
   - Ejecuta este query (reemplaza `USER_ID` con el ID del usuario que acabas de crear):
   ```sql
   -- Primero, obtener el ID del usuario
   SELECT id, email FROM auth.users WHERE email = 'admin@partequipos.com';
   
   -- Luego, actualizar el rol (usa el ID que obtuviste arriba)
   UPDATE public.users 
   SET role = 'admin', 
       username = 'admin',
       full_name = 'Administrador Sistema'
   WHERE id = 'USER_ID_AQUI';
   ```

4. **Crear Más Usuarios (Opcional):**
   - Repite el proceso para crear:
     - `user1@partequipos.com` (rol: `user`)
     - `comercial@partequipos.com` (rol: `commercial`)
     - `invitado@partequipos.com` (rol: `guest`)

## 📋 Paso 5: Configurar Archivo .env

1. **Abrir el archivo `.env` en tu proyecto:**
   - Debe estar en la raíz del proyecto

2. **Actualizar con tus credenciales:**
   ```env
   VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_KEY_AQUI
   ```

3. **Guardar el archivo**

## 📋 Paso 6: Verificar Conexión

1. **Iniciar el servidor de desarrollo:**
   ```powershell
   npm run dev
   ```

2. **Abrir en el navegador:**
   - Ve a: http://localhost:5173
   - Intenta iniciar sesión con:
     - Email: `admin@partequipos.com`
     - Password: `Password123!`

3. **Si funciona:**
   - ✅ ¡Todo está configurado correctamente!

## 🔧 Solución de Problemas

### Error: "Failed to fetch"
- **Causa:** Las credenciales en `.env` son incorrectas o faltantes
- **Solución:** Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén correctos

### Error: "User not found"
- **Causa:** El usuario no existe en `public.users`
- **Solución:** Verifica que el trigger `handle_new_user()` se ejecutó correctamente, o crea el usuario manualmente en `public.users`

### Error: "Permission denied"
- **Causa:** Las políticas RLS están bloqueando el acceso
- **Solución:** Verifica que el usuario tenga el rol correcto en `public.users`

### Error al ejecutar el script SQL
- **Causa:** Puede haber un error de sintaxis o dependencias
- **Solución:** 
  1. Ejecuta el script por partes (tablas primero, luego funciones, luego triggers)
  2. Revisa los mensajes de error en la consola de Supabase
  3. Asegúrate de que las extensiones estén habilitadas

## 📊 Verificar Tablas Creadas

Para verificar que todo se creó correctamente:

1. **Ir a Table Editor:**
   - En el menú lateral, haz clic en **"Table Editor"**
   - Deberías ver todas las tablas:
     - `users`
     - `equipment`
     - `operation_hours`
     - `fuel_logs`
     - `operations`
     - `pre_operational_checklists`
     - `transport_requests`
     - `expense_claims`
     - `holidays`
     - `system_alerts`
     - `audit_logs`

2. **Verificar Días Festivos:**
   - Abre la tabla `holidays`
   - Deberías ver 18 días festivos de Colombia 2025

## 🎯 Próximos Pasos

Una vez configurado Supabase:

1. ✅ Crear usuarios de prueba en Authentication
2. ✅ Actualizar roles en `public.users`
3. ✅ Probar login en la aplicación
4. ✅ Agregar datos de prueba (equipos, operaciones, etc.)

## 📝 Notas Importantes

- **Autenticación:** Supabase maneja la autenticación en `auth.users`, pero el perfil extendido está en `public.users`
- **RLS (Row Level Security):** Las políticas están configuradas para que solo usuarios autenticados puedan acceder
- **Triggers:** Los triggers automáticos sincronizan usuarios y calculan horas automáticamente
- **Backup:** Asegúrate de hacer backups regulares de tu base de datos en Supabase

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs en Supabase Dashboard → Logs
2. Verifica que todas las tablas se crearon correctamente
3. Asegúrate de que el usuario tenga el rol correcto en `public.users`

---

**¡Listo!** Tu base de datos Supabase está configurada y lista para usar. 🚀

