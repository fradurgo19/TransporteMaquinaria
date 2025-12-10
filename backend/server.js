// Servidor Express para servicio de emails
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Email service running' });
});

// Endpoint manual para enviar alertas
app.post('/send-alerts', (req, res) => {
  exec('node send-alerts.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Alerts sent', output: stdout });
  });
});

// Endpoint para enviar notificaciones de operaciones
app.post('/send-operation-notification', async (req, res) => {
  try {
    const { operation_id } = req.body;
    
    if (!operation_id) {
      return res.status(400).json({ error: 'operation_id es requerido' });
    }

    // Importar y ejecutar la función
    const { sendOperationNotification } = await import('./send-operation-notification.js');
    const result = await sendOperationNotification(operation_id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error en /send-operation-notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para enviar notificaciones de solicitudes de transporte
app.post('/send-transport-request-notification', async (req, res) => {
  try {
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id es requerido' });
    }

    // Importar y ejecutar la función
    const { sendTransportRequestNotification } = await import('./send-transport-request-notification.js');
    const result = await sendTransportRequestNotification(request_id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error en /send-transport-request-notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cron job: Ejecutar todos los días a las 8:00 AM
cron.schedule('0 8 * * *', () => {
  console.log('⏰ Ejecutando envío automático de alertas...');
  exec('node send-alerts.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error en cron job:', error);
      return;
    }
    console.log('✅ Cron job completado:', stdout);
  });
}, {
  timezone: "America/Bogota"
});

app.listen(PORT, () => {
  console.log(`🚀 Email service running on port ${PORT}`);
  console.log(`⏰ Cron job configurado: Envío diario a las 8:00 AM (Bogotá)`);
});

