// Supabase Edge Function para enviar alertas de vencimiento por email
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  username: 'fradurgo19@gmail.com',
  password: 'asovvyyfobpuzzvd',
};

const EMAIL_RECIPIENTS = {
  transport: 'logisticamq1@partequipos.com',
  logistics: 'bodega.medellin@partequipos.com',
};

const COMPANY_LOGO = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

interface DocumentExpiring {
  equipment_id: string;
  license_plate: string;
  driver_name: string;
  brand: string;
  site_location: string;
  document_type: string;
  expiration_date: string;
  days_until_expiration: number;
  notification_type: string;
  department: string;
}

const getDocumentLabel = (type: string): string => {
  const labels: Record<string, string> = {
    tecno: 'Revisión Técnico-Mecánica',
    soat: 'SOAT',
    poliza: 'Póliza de Seguro',
    licencia: 'Licencia de Conducción',
  };
  return labels[type] || type;
};

const generateEmailHTML = (doc: DocumentExpiring): string => {
  const docLabel = getDocumentLabel(doc.document_type);
  const urgencyColor = doc.days_until_expiration === 5 ? '#dc2626' : '#f59e0b';
  const urgencyText = doc.days_until_expiration === 5 ? '¡URGENTE!' : 'ATENCIÓN';
  const departmentLabel = doc.department === 'transport' ? 'Transporte Maquinaria' : 'Logística';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Vencimiento - ${docLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <img src="${COMPANY_LOGO}" alt="Partequipos" style="max-width: 200px; height: auto; margin-bottom: 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Partequipos S.A.S</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0; font-size: 16px;">${departmentLabel}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 30px 20px; text-align: center;">
              <div style="display: inline-block; background-color: ${urgencyColor}; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 18px;">
                ${urgencyText} - Documento por vencer
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Estimado Equipo de ${departmentLabel},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Le informamos que el siguiente documento está próximo a vencer en <strong style="color: ${urgencyColor};">${doc.days_until_expiration} días</strong>:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; width: 40%;">Documento:</td>
                        <td style="color: #111827; font-size: 16px; font-weight: 700;">${docLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600;">Placa:</td>
                        <td style="color: #111827; font-size: 16px; font-weight: 700;">${doc.license_plate}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600;">Conductor:</td>
                        <td style="color: #111827; font-size: 16px;">${doc.driver_name}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600;">Marca:</td>
                        <td style="color: #111827; font-size: 16px;">${doc.brand}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600;">Sede:</td>
                        <td style="color: #111827; font-size: 16px;">${doc.site_location}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600;">Fecha de Vencimiento:</td>
                        <td style="color: ${urgencyColor}; font-size: 18px; font-weight: 700;">${new Date(doc.expiration_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                  ⚠️ Acción Requerida
                </p>
                <p style="color: #78350f; font-size: 13px; margin: 8px 0 0; line-height: 1.5;">
                  Por favor, tome las acciones necesarias para renovar este documento antes de su vencimiento y evitar sanciones o inmovilización del vehículo.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">
                <strong>Partequipos S.A.S</strong><br>
                Sistema de Gestión de Transporte
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Este es un mensaje automático, por favor no responder a este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

async function sendEmail(to: string, subject: string, html: string) {
  // Usar API de correo SMTP
  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: 'YOUR_SMTP2GO_API_KEY', // Cambiar por API key real
      to: [to],
      sender: SMTP_CONFIG.username,
      subject: subject,
      html_body: html,
    }),
  });

  return response.ok;
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Obtener documentos pendientes de notificación
    const { data: pendingDocs, error } = await supabaseClient
      .rpc('get_pending_notifications');

    if (error) throw error;

    if (!pendingDocs || pendingDocs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No hay notificaciones pendientes', sent: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const doc of pendingDocs) {
      const recipient = doc.department === 'transport' 
        ? EMAIL_RECIPIENTS.transport 
        : EMAIL_RECIPIENTS.logistics;

      const subject = `⚠️ ${doc.days_until_expiration === 5 ? 'URGENTE' : 'ALERTA'}: ${getDocumentLabel(doc.document_type)} vence en ${doc.days_until_expiration} días - ${doc.license_plate}`;
      
      const html = generateEmailHTML(doc);

      const success = await sendEmail(recipient, subject, html);

      if (success) {
        // Registrar notificación enviada
        await supabaseClient.from('email_notifications').insert({
          equipment_id: doc.equipment_id,
          document_type: doc.document_type,
          expiration_date: doc.expiration_date,
          notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          sent_to: recipient,
          email_subject: subject,
          email_body: html,
          status: 'sent',
        });
        sent++;
      } else {
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notificaciones procesadas',
        sent,
        failed,
        total: pendingDocs.length 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

