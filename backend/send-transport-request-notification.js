// Script para enviar notificaciones de solicitudes de transporte
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

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

// Destinatarios (igual que otras notificaciones)
const EMAIL_RECIPIENTS = {
  transport: process.env.EMAIL_TRANSPORT || 'logisticamq1@partequipos.com',
  logistics: process.env.EMAIL_LOGISTICS || 'bodega.medellin@partequipos.com',
};

const generateEmailHTML = (request) => {
  const requestDate = new Date(request.created_at).toLocaleString('es-CO', {
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
            <p style="color:#e0e7ff;margin:10px 0 0;font-size:16px;">Nueva Solicitud de Transporte</p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 30px 20px;text-align:center;">
            <div style="display:inline-block;background-color:#10b981;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:18px;">
              🚛 Nueva Solicitud de Transporte
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 30px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
              Se ha recibido una nueva solicitud de transporte de equipos:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:2px solid #e5e7eb;margin-bottom:30px;">
              <tr><td style="padding:24px;">
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;width:40%;">Serie:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${request.serie}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Descripción:</td>
                    <td style="color:#111827;font-size:16px;">${request.descripcion}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Marca:</td>
                    <td style="color:#111827;font-size:16px;">${request.marca}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Modelo:</td>
                    <td style="color:#111827;font-size:16px;">${request.modelo || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Peso:</td>
                    <td style="color:#111827;font-size:16px;">${request.peso ? `${request.peso} kg` : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Dimensiones:</td>
                    <td style="color:#111827;font-size:16px;">
                      ${request.ancho && request.alto && request.largo 
                        ? `${request.largo}m × ${request.ancho}m × ${request.alto}m` 
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:12px;"></td></tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Destinatario:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${request.nombre_destinatario}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Dirección:</td>
                    <td style="color:#111827;font-size:16px;">${request.direccion}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Ciudad:</td>
                    <td style="color:#111827;font-size:16px;">${request.ciudad}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Celular:</td>
                    <td style="color:#111827;font-size:16px;">${request.celular}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Origen de Cargue:</td>
                    <td style="color:#111827;font-size:16px;">${request.origen_cargue}</td>
                  </tr>
                  ${request.fecha_entrega ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Fecha de Entrega:</td>
                    <td style="color:#111827;font-size:16px;">${new Date(request.fecha_entrega).toLocaleDateString('es-CO')}</td>
                  </tr>
                  ` : ''}
                  ${request.persona_entrega ? `
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Persona que Entrega:</td>
                    <td style="color:#111827;font-size:16px;">${request.persona_entrega}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">V.B. Ingeniero:</td>
                    <td style="color:#111827;font-size:16px;">
                      ${request.vb_ingeniero ? '✓ Aprobado' : 'Pendiente'}
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Fecha de Solicitud:</td>
                    <td style="color:#111827;font-size:16px;">${requestDate}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;">
              <p style="color:#92400e;font-size:14px;margin:0;font-weight:600;">⚠️ Acción Requerida</p>
              <p style="color:#78350f;font-size:13px;margin:8px 0 0;">
                Por favor, revise y procese esta solicitud de transporte lo antes posible.
              </p>
            </div>
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

async function sendTransportRequestNotification(requestId) {
  try {
    console.log('🔍 Obteniendo información de la solicitud:', requestId);
    
    // 1. Obtener información de la solicitud
    const { data: request, error: requestError } = await supabase
      .from('transport_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.error('❌ Error:', requestError);
      return { success: false, error: 'Solicitud no encontrada' };
    }

    // 2. Obtener información del usuario que hizo la solicitud
    const { data: user } = await supabase
      .from('users')
      .select('full_name, username, email')
      .eq('id', request.requested_by)
      .single();

    // 3. Preparar destinatarios
    const recipients = [
      EMAIL_RECIPIENTS.transport,
      EMAIL_RECIPIENTS.logistics,
    ];

    // Agregar email del solicitante si está disponible
    if (user?.email && !recipients.includes(user.email)) {
      recipients.push(user.email);
    }

    // 4. Preparar email
    const emailSubject = `🚛 Nueva Solicitud de Transporte - Serie: ${request.serie}`;
    const emailBody = generateEmailHTML(request);

    // 5. Enviar emails
    const sentNotifications = [];
    const failedNotifications = [];

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: '"Partequipos Sistema" <fradurgo19@gmail.com>',
          to: recipient,
          subject: emailSubject,
          html: emailBody,
        });

        sentNotifications.push(recipient);
        console.log(`✅ Email enviado: ${request.serie} → ${recipient}`);
      } catch (emailError) {
        console.error(`❌ Error enviando email a ${recipient}:`, emailError);
        failedNotifications.push({
          email: recipient,
          error: emailError.message,
        });
      }
    }

    console.log('✅ Proceso completado');
    return {
      success: true,
      request_id: requestId,
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
const requestId = process.argv[2];
if (requestId) {
  sendTransportRequestNotification(requestId)
    .then(result => {
      console.log('Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

export { sendTransportRequestNotification };

