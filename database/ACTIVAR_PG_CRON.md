# 🕐 Activación de pg_cron en Supabase

Este documento explica cómo activar `pg_cron` y configurar los cron jobs automáticos para las notificaciones de vencimiento de documentos.

## 📋 Pasos Previos

Antes de ejecutar el script SQL, necesitas obtener:

1. **URL de tu proyecto Supabase:**
   - Ve a Supabase Dashboard → Settings → API
   - Copia la "Project URL" (ejemplo: `https://ilufjftwomzjghhesixt.supabase.co`)

2. **Service Role Key:**
   - En la misma página (Settings → API)
   - Copia el "service_role" key (⚠️ **NO** uses el "anon" key)
   - Este key tiene permisos completos, mantenlo seguro

## 🚀 Ejecución del Script

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a **Supabase Dashboard → SQL Editor**
2. Abre el archivo `database/setup_automatic_email_notifications.sql`
3. **Reemplaza los siguientes valores:**
   - `TU_PROYECTO` → Tu project ID (ej: `ilufjftwomzjghhesixt`)
   - `TU_SERVICE_ROLE_KEY` → Tu service role key completo
4. Ejecuta el script completo
5. Verifica que no haya errores

### Opción 2: Desde la línea de comandos

```bash
# Si tienes Supabase CLI configurado
supabase db execute -f database/setup_automatic_email_notifications.sql
```

## ✅ Verificación

Después de ejecutar el script, verifica que todo esté configurado:

### 1. Verificar que pg_cron está habilitado:

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

Deberías ver una fila con `extname = 'pg_cron'`.

### 2. Verificar que el cron job fue creado:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'send-expiration-alerts-daily';
```

Deberías ver una fila con:
- `jobname = 'send-expiration-alerts-daily'`
- `schedule = '0 8 * * *'`
- `active = true`

### 3. Ver historial de ejecuciones:

```sql
SELECT 
  jobid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'send-expiration-alerts-daily'
)
ORDER BY start_time DESC 
LIMIT 10;
```

### 4. Probar manualmente la Edge Function:

Puedes probar la función manualmente desde el Dashboard:
- Ve a **Edge Functions → send-expiration-alerts → Invoke**
- O usa curl:

```bash
curl -X POST https://TU_PROYECTO.supabase.co/functions/v1/send-expiration-alerts \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🔧 Solución de Problemas

### Error: "extension pg_cron does not exist"

**Causa:** `pg_cron` no está habilitado en tu proyecto.

**Solución:**
1. Ve a **Supabase Dashboard → Database → Extensions**
2. Busca `pg_cron` y haz clic en "Enable"
3. O contacta al soporte de Supabase si no aparece en la lista

### Error: "permission denied for schema cron"

**Causa:** No tienes permisos para crear cron jobs.

**Solución:**
- Asegúrate de estar usando el usuario correcto (generalmente `postgres` o un usuario con permisos de superusuario)
- En Supabase, esto generalmente no debería pasar, pero si ocurre, contacta al soporte

### Error: "extension pg_net does not exist"

**Causa:** `pg_net` no está habilitado.

**Solución:**
1. Ve a **Supabase Dashboard → Database → Extensions**
2. Busca `pg_net` y haz clic en "Enable"
3. Si no está disponible, usa la **Opción Alternativa** (Dashboard Cron Jobs)

### El cron job no se ejecuta

**Verificaciones:**
1. Confirma que el cron job está activo: `SELECT active FROM cron.job WHERE jobname = 'send-expiration-alerts-daily';`
2. Revisa los logs de ejecución: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-expiration-alerts-daily') ORDER BY start_time DESC LIMIT 5;`
3. Verifica que la URL de la Edge Function sea correcta
4. Verifica que el Service Role Key sea correcto

## 🔄 Alternativa: Usar Dashboard Cron Jobs

Si `pg_cron` no funciona o prefieres usar la interfaz del Dashboard:

1. Ve a **Supabase Dashboard → Database → Cron Jobs** (o **Integrations → Cron**)
2. Haz clic en **"Create a new cron job"**
3. Configura:
   - **Name:** `send-expiration-alerts-daily`
   - **Schedule:** `0 8 * * *` (8:00 AM diario)
   - **Type:** HTTP Request
   - **URL:** `https://TU_PROYECTO.supabase.co/functions/v1/send-expiration-alerts`
   - **Method:** POST
   - **Headers:**
     - `Authorization: Bearer TU_SERVICE_ROLE_KEY`
     - `Content-Type: application/json`
   - **Body:** `{}`
4. Guarda el cron job

## 📧 Verificar que los emails se envían

1. Revisa la tabla `email_notifications`:
   ```sql
   SELECT * FROM email_notifications 
   ORDER BY sent_at DESC 
   LIMIT 10;
   ```

2. Verifica que los emails lleguen a `logisticamq1@partequipos.com`

3. Revisa los logs de la Edge Function:
   - **Supabase Dashboard → Edge Functions → send-expiration-alerts → Logs**

## 🎯 Resumen

Una vez configurado correctamente:
- ✅ `pg_cron` está habilitado
- ✅ `pg_net` está habilitado (si está disponible)
- ✅ El cron job `send-expiration-alerts-daily` está programado para ejecutarse diariamente a las 8:00 AM
- ✅ La Edge Function `send-expiration-alerts` se ejecutará automáticamente
- ✅ Los emails se enviarán a `logisticamq1@partequipos.com` cuando haya documentos por vencer (10 días y 5 días antes)

