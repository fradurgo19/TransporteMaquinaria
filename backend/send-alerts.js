// Script para enviar alertas de vencimiento
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env desde la carpeta correcta
config({ path: join(__dirname, '.env') });

// Hardcoded config (mientras dotenv no funciona)
const SUPABASE_URL = 'https://ilufjftwomzjghhesixt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdWZqZnR3b216amdoaGVzaXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5NDA0NSwiZXhwIjoyMDc5MDcwMDQ1fQ.ODF_lB6lbyLnN00lTE1aU2vfkq1XxOP1iAK74T31uDw';

// Destinatarios por departamento
const EMAIL_RECIPIENTS = {
  transport: [
    'auxiliar.logisticamq@partequipos.com',
    'logisticamq@partequipos.com',
    'lgonzalez@partequipos.com'
  ],
  logistics: ['bodega.medellin@partequipos.com']
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'fradurgo19@gmail.com',
    pass: 'asovvyyfobpuzzvd',
  },
});

const COMPANY_LOGO = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

const getDocumentLabel = (type) => {
  const labels = {
    tecno: 'Revisión Técnico-Mecánica',
    soat: 'SOAT',
    poliza: 'Póliza de Seguro',
    licencia: 'Licencia de Conducción',
  };
  return labels[type] || type;
};

const generateEmailHTML = (doc) => {
  const docLabel = getDocumentLabel(doc.document_type);
  const urgencyColor = doc.days_until_expiration === 5 ? '#dc2626' : '#f59e0b';
  const urgencyText = doc.days_until_expiration === 5 ? '¡URGENTE!' : 'ATENCIÓN';
  const departmentLabel = doc.department === 'transport' ? 'Transporte Maquinaria' : 'Logística';
  const expDate = new Date(doc.expiration_date).toLocaleDateString('es-CO', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
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
            <p style="color:#e0e7ff;margin:10px 0 0;font-size:16px;">${departmentLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 30px 20px;text-align:center;">
            <div style="display:inline-block;background-color:${urgencyColor};color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:18px;">
              ${urgencyText} - Documento por vencer
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 30px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
              Estimado Equipo de ${departmentLabel},
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">
              Le informamos que el siguiente documento está próximo a vencer en <strong style="color:${urgencyColor};">${doc.days_until_expiration} días</strong>:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:2px solid #e5e7eb;margin-bottom:30px;">
              <tr><td style="padding:24px;">
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;width:40%;">Documento:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${docLabel}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Placa:</td>
                    <td style="color:#111827;font-size:16px;font-weight:700;">${doc.license_plate}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Conductor:</td>
                    <td style="color:#111827;font-size:16px;">${doc.driver_name}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Marca:</td>
                    <td style="color:#111827;font-size:16px;">${doc.brand}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Sede:</td>
                    <td style="color:#111827;font-size:16px;">${doc.site_location}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:14px;font-weight:600;">Fecha de Vencimiento:</td>
                    <td style="color:${urgencyColor};font-size:18px;font-weight:700;">${expDate}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;">
              <p style="color:#92400e;font-size:14px;margin:0;font-weight:600;">⚠️ Acción Requerida</p>
              <p style="color:#78350f;font-size:13px;margin:8px 0 0;">
                Por favor, tome las acciones necesarias para renovar este documento antes de su vencimiento.
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
  `;
};

async function sendDailyAlerts() {
  try {
    console.log('🔍 Obteniendo documentos pendientes...');
    
    const { data: pendingDocs, error } = await supabase
      .rpc('get_pending_notifications');

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      console.log('✅ No hay alertas pendientes hoy');
      return;
    }

    console.log(`📧 Procesando ${pendingDocs.length} alertas...`);

    for (const doc of pendingDocs) {
      const recipients = doc.department === 'transport' 
        ? EMAIL_RECIPIENTS.transport 
        : EMAIL_RECIPIENTS.logistics;
      
      const recipientList = recipients.join(', ');

      const docLabel = getDocumentLabel(doc.document_type);
      const urgency = doc.days_until_expiration === 5 ? 'URGENTE' : 'ALERTA';
      
      const subject = `⚠️ ${urgency}: ${docLabel} vence en ${doc.days_until_expiration} días - ${doc.license_plate}`;
      const html = generateEmailHTML(doc);

      try {
        await transporter.sendMail({
          from: '"Partequipos Sistema" <fradurgo19@gmail.com>',
          to: recipients, // Array de emails
          subject: subject,
          html: html,
        });

        // Registrar en BD
        await supabase.from('email_notifications').insert({
          equipment_id: doc.equipment_id,
          document_type: doc.document_type,
          expiration_date: doc.expiration_date,
          notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          sent_to: recipientList,
          email_subject: subject,
          email_body: html,
          status: 'sent',
        });

        console.log(`✅ Email enviado: ${doc.license_plate} → ${recipientList}`);
      } catch (emailError) {
        console.error(`❌ Error enviando email para ${doc.license_plate}:`, emailError);
        
        // Registrar como fallido
        await supabase.from('email_notifications').insert({
          equipment_id: doc.equipment_id,
          document_type: doc.document_type,
          expiration_date: doc.expiration_date,
          notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          sent_to: recipientList,
          email_subject: subject,
          status: 'failed',
        });
      }
    }

    console.log('✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar
sendDailyAlerts();

