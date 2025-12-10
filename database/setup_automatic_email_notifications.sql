-- ============================================
-- CONFIGURACIÓN DE NOTIFICACIONES AUTOMÁTICAS POR EMAIL
-- Ejecuta automáticamente send-expiration-alerts diariamente
-- ============================================

-- PASO 1: Habilitar extensión pg_cron
-- Nota: En Supabase, pg_cron está disponible pero puede requerir permisos especiales
-- Si obtienes un error de permisos, contacta al soporte de Supabase o usa el Dashboard

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verificar que pg_cron está habilitado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE '✅ pg_cron está habilitado correctamente';
  ELSE
    RAISE WARNING '⚠️ pg_cron no está disponible. Usa el Dashboard de Supabase para configurar Cron Jobs.';
  END IF;
END $$;

-- PASO 2: Habilitar extensión pg_net (necesaria para hacer HTTP requests desde pg_cron)
-- Esta extensión permite hacer llamadas HTTP a las Edge Functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- PASO 3: Configurar el cron job para ejecutar send-expiration-alerts diariamente
-- ✅ Configurado con las credenciales del proyecto

-- Primero, eliminar el cron job si ya existe (para evitar duplicados)
SELECT cron.unschedule('send-expiration-alerts-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-expiration-alerts-daily'
);

-- Crear el cron job que ejecuta la Edge Function diariamente a las 8:00 AM
-- Formato cron: 'minuto hora día_mes mes día_semana'
-- '0 8 * * *' = Todos los días a las 8:00 AM
SELECT cron.schedule(
  'send-expiration-alerts-daily',                    -- Nombre del job
  '0 8 * * *',                                       -- Schedule: 8:00 AM diario
  $$
  SELECT net.http_post(
    url := 'https://ilufjftwomzjghhesixt.supabase.co/functions/v1/send-expiration-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verificar que el cron job fue creado
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'send-expiration-alerts-daily';

-- Ver historial de ejecuciones del cron job
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-expiration-alerts-daily')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- ============================================
-- INSTRUCCIONES ALTERNATIVAS (si pg_cron no funciona)
-- ============================================
-- Si no puedes usar pg_cron directamente, configura el Cron Job desde el Dashboard:
--
-- 1. Ve a Supabase Dashboard → Database → Cron Jobs (o Integrations → Cron)
-- 2. Haz clic en "Create a new cron job"
-- 3. Configura:
--    - Name: send-expiration-alerts-daily
--    - Schedule: 0 8 * * * (8:00 AM diario)
--    - SQL Command: (deja vacío, usaremos HTTP)
--    - O mejor: usa "HTTP Request" como tipo de job
--    - URL: https://ilufjftwomzjghhesixt.supabase.co/functions/v1/send-expiration-alerts
--    - Method: POST
--    - Headers: 
--        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw
--        Content-Type: application/json
--    - Body: {}
-- 4. Guarda el cron job
--
-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Para verificar que todo funciona:
-- 1. Ejecuta manualmente la Edge Function desde el Dashboard o con curl:
--    curl -X POST https://ilufjftwomzjghhesixt.supabase.co/functions/v1/send-expiration-alerts \
--      -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw" \
--      -H "Content-Type: application/json"
--
-- 2. Revisa los logs en Supabase Dashboard → Edge Functions → send-expiration-alerts → Logs
--
-- 3. Verifica que los emails lleguen a logisticamq1@partequipos.com
--
-- 4. Revisa la tabla email_notifications para ver el registro de notificaciones enviadas:
--    SELECT * FROM email_notifications ORDER BY sent_at DESC LIMIT 10;
