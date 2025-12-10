-- ============================================
-- PRUEBA MANUAL DE send-expiration-alerts
-- Ejecuta este script para probar la Edge Function manualmente
-- ============================================

-- Verificar que hay documentos por vencer
SELECT 
  'Documentos por vencer encontrados:' AS info,
  COUNT(*) AS total
FROM get_pending_notifications();

-- Ver detalles de documentos por vencer
SELECT 
  license_plate,
  driver_name,
  document_type,
  expiration_date,
  days_until_expiration,
  alert_type
FROM get_pending_notifications()
ORDER BY expiration_date ASC
LIMIT 10;

-- Ejecutar la Edge Function manualmente
SELECT 
  'Ejecutando Edge Function send-expiration-alerts...' AS status,
  net.http_post(
    url := 'https://ilufjftwomzjghhesixt.supabase.co/functions/v1/send-expiration-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw'
    ),
    body := '{}'::jsonb
  ) AS request_id;

-- Esperar unos segundos y verificar el estado de la petición HTTP
-- (Nota: Esto puede requerir verificar en la tabla de pg_net o en los logs de la Edge Function)

-- Verificar notificaciones enviadas recientemente
SELECT 
  'Notificaciones enviadas recientemente:' AS info,
  COUNT(*) AS total
FROM email_notifications
WHERE sent_at > NOW() - INTERVAL '1 hour';

-- Ver detalles de las últimas notificaciones
SELECT 
  id,
  equipment_id,
  document_type,
  expiration_date,
  days_until_expiration,
  alert_type,
  sent_at,
  status,
  error_message
FROM email_notifications
ORDER BY sent_at DESC
LIMIT 10;

