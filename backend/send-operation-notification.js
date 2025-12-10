// Script para enviar notificaciones de operaciones
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env desde la carpeta correcta
config({ path: join(__dirname, '.env') });

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ilufjftwomzjghhesixt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'fradurgo19@gmail.com',
    pass: process.env.SMTP_PASS || 'asovvyyfobpuzzvd',
  },
});

const COMPANY_LOGO = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

// Destinatarios para notificaciones de operaciones
const EMAIL_RECIPIENTS = {
  transport: process.env.EMAIL_TRANSPORT || 'logisticamq1@partequipos.com',
  logistics: process.env.EMAIL_LOGISTICS || 'bodega.medellin@partequipos.com',
};

const getOperationTypeLabel = (type) => {
  const labels = {
    loading: 'Carga',
    route_start: 'Inicio de Recorrido',
    delivery: 'Entrega',
  };
  return labels[type] || type;
};

const generateEmailHTML = (operation) => {
  const operationType = getOperationTypeLabel(operation.operation_type);
  const timestamp = new Date(operation.operation_timestamp).toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:40px 30px;text-align:center;">
            <img src="${COMPANY_LOGO}" alt="Partequipos" style="max-width:200px;height:auto;margin-bottom:20px;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">Partequipos S.A.S</h1>
            <p style="color:#e0e7ff;margin:10px 0 0;font-size:16px;">Transporte Maquinaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 30px 20px;text-align:center;">
            <div style="display:inline-block;background-color:#10b981;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:18px;">
              🚛 Nueva Operación Registrada
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 30px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
              Estimado Equipo de Transporte Maquinaria,
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">
              Se ha registrado una nueva operación en el sistema:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:2px solid #e5e7eb;margin-bottom:30px;">
              <tr><td style="padding:24px;">
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;width:40%;">Tipo de Operación:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${operationType}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Vehículo:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${operation.vehicle_plate}</td>
                  </tr>
                  ${operation.equipment_serial ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Serie del Equipo:</td>
                    <td style="color:#111827;font-size:16px;">${operation.equipment_serial}</td>
                  </tr>
                  ` : ''}
                  ${operation.driver_name ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Conductor:</td>
                    <td style="color:#111827;font-size:16px;">${operation.driver_name}</td>
                  </tr>
                  ` : ''}
                  ${operation.origin ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Origen:</td>
                    <td style="color:#111827;font-size:16px;">${operation.origin}</td>
                  </tr>
                  ` : ''}
                  ${operation.destination ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Destino:</td>
                    <td style="color:#111827;font-size:16px;">${operation.destination}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Fecha y Hora:</td>
                    <td style="color:#111827;font-size:16px;">${timestamp}</td>
                  </tr>
                  ${operation.notes ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Notas:</td>
                    <td style="color:#111827;font-size:16px;">${operation.notes}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Ubicación GPS:</td>
                    <td style="color:#111827;font-size:16px;">
                      Lat: ${operation.gps_latitude?.toFixed(6) || 'N/A'}, 
                      Lng: ${operation.gps_longitude?.toFixed(6) || 'N/A'}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#6b7280;font-size:13px;margin:0;"><strong>Partequipos S.A.S</strong><br>Sistema de Gestión de Transporte</p>
            <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;">Este es un mensaje automático.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
};

async function sendOperationNotification(operationId) {
  try {
    console.log('🔍 Obteniendo información de la operación:', operationId);
    
    // 1. Obtener información de la operación
    const { data: operation, error: operationError } = await supabase
      .from('operations')
      .select('*')
      .eq('id', operationId)
      .single();

    if (operationError || !operation) {
      console.error('❌ Error:', operationError);
      return { success: false, error: 'Operación no encontrada' };
    }

    // 2. Obtener destinatarios
    const { data: recipients, error: recipientsError } = await supabase
      .rpc('get_operation_notification_recipients', { operation_id_param: operationId });

    if (recipientsError) {
      console.error('❌ Error obteniendo destinatarios:', recipientsError);
    }

    // 3. Preparar destinatarios (siempre incluir logisticamq1@partequipos.com)
    const allRecipients = [];
    
    if (recipients && recipients.length > 0) {
      recipients.forEach(r => {
        if (!allRecipients.includes(r.email)) {
          allRecipients.push(r.email);
        }
      });
    }
    
    // Siempre incluir logisticamq1@partequipos.com
    if (!allRecipients.includes(EMAIL_RECIPIENTS.transport)) {
      allRecipients.push(EMAIL_RECIPIENTS.transport);
    }

    if (allRecipients.length === 0) {
      console.warn('⚠️ No hay destinatarios, usando email por defecto');
      allRecipients.push(EMAIL_RECIPIENTS.transport);
    }

    // 4. Preparar email
    const operationType = getOperationTypeLabel(operation.operation_type);
    const emailSubject = `Nueva Operación: ${operationType} - Vehículo ${operation.vehicle_plate}`;
    const emailBody = generateEmailHTML(operation);

    // 5. Enviar emails
    const sentNotifications = [];
    const failedNotifications = [];

    for (const recipient of allRecipients) {
      try {
        await transporter.sendMail({
          from: '"Partequipos Sistema" <fradurgo19@gmail.com>',
          to: recipient,
          subject: emailSubject,
          html: emailBody,
        });

        // Registrar en BD
        await supabase.from('operation_notifications').insert({
          operation_id: operationId,
          sent_to: recipient,
          email_subject: emailSubject,
          email_body: emailBody,
          status: 'sent',
        });

        sentNotifications.push(recipient);
        console.log(`✅ Email enviado: ${operation.vehicle_plate} → ${recipient}`);
      } catch (emailError) {
        console.error(`❌ Error enviando email a ${recipient}:`, emailError);
        
        // Registrar como fallido
        await supabase.from('operation_notifications').insert({
          operation_id: operationId,
          sent_to: recipient,
          email_subject: emailSubject,
          status: 'failed',
          error_message: emailError.message,
        });

        failedNotifications.push({
          email: recipient,
          error: emailError.message,
        });
      }
    }

    // 6. Marcar operación como notificada
    if (sentNotifications.length > 0) {
      await supabase.rpc('mark_operation_notified', {
        operation_id_param: operationId,
      });
    }

    console.log('✅ Proceso completado');
    return {
      success: true,
      operation_id: operationId,
      sent: sentNotifications.length,
      failed: failedNotifications.length,
      sent_to: sentNotifications,
      failed_to: failedNotifications,
    };
  } catch (error) {
    console.error('❌ Error general:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar si se llama directamente
const operationId = process.argv[2];
if (operationId) {
  sendOperationNotification(operationId)
    .then(result => {
      console.log('Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

export { sendOperationNotification };

