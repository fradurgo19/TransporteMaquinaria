# Servicio de Emails Automáticos

## Instalación

```bash
cd backend
npm install
```

## Configuración

Edita `backend/.env` y agrega tu SUPABASE_SERVICE_KEY

## Ejecutar

```bash
# Iniciar servidor (con cron automático)
npm start

# O solo enviar alertas manualmente
npm run send-alerts
```

## Cron Job

Envía emails automáticamente todos los días a las 8:00 AM (Colombia)

