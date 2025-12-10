// Supabase Edge Function para enviar notificaciones de vencimiento de documentos usando SMTP Gmail
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuración SMTP Gmail (sincronizada con backend)
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'fradurgo19@gmail.com',
  pass: 'asovvyyfobpuzzvd', // Contraseña del backend
  from: 'fradurgo19@gmail.com',
  fromName: 'Partequipos - Sistema de Transporte',
};

// Destinatarios por departamento (igual que backend)
const EMAIL_RECIPIENTS = {
  transport: [
    'auxiliar.logisticamq@partequipos.com',
    'logisticamq@partequipos.com',
    'lgonzalez@partequipos.com'
  ],
  logistics: ['bodega.medellin@partequipos.com']
};

const COMPANY_LOGO = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

// Función para enviar email usando SMTP vía TLS
const sendEmailSMTP = async (to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Conectar a SMTP con TLS
    const conn = await Deno.connectTls({
      hostname: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
    });

    try {
      const buffer = new Uint8Array(4096);
      
      // Leer saludo inicial
      const n = await conn.read(buffer);
      if (n === null) throw new Error('No se pudo conectar a SMTP');
      let response = decoder.decode(buffer.subarray(0, n));
      console.log('SMTP:', response);

      // EHLO
      await conn.write(encoder.encode(`EHLO ${SMTP_CONFIG.host}\r\n`));
      const n2 = await conn.read(buffer);
      if (n2 === null) throw new Error('Error en EHLO');
      response = decoder.decode(buffer.subarray(0, n2));
      console.log('EHLO:', response);

      // AUTH LOGIN
      await conn.write(encoder.encode(`AUTH LOGIN\r\n`));
      const n3 = await conn.read(buffer);
      if (n3 === null) throw new Error('Error en AUTH LOGIN');
      response = decoder.decode(buffer.subarray(0, n3));

      // Enviar usuario (base64)
      const userB64 = btoa(SMTP_CONFIG.user);
      await conn.write(encoder.encode(`${userB64}\r\n`));
      const n4 = await conn.read(buffer);
      if (n4 === null) throw new Error('Error en usuario');
      response = decoder.decode(buffer.subarray(0, n4));

      // Enviar contraseña (base64)
      const passB64 = btoa(SMTP_CONFIG.pass);
      await conn.write(encoder.encode(`${passB64}\r\n`));
      const n5 = await conn.read(buffer);
      if (n5 === null) throw new Error('Error en contraseña');
      response = decoder.decode(buffer.subarray(0, n5));

      if (!response.startsWith('235')) {
        throw new Error(`Autenticación fallida: ${response}`);
      }

      // MAIL FROM
      await conn.write(encoder.encode(`MAIL FROM:<${SMTP_CONFIG.from}>\r\n`));
      const n6 = await conn.read(buffer);
      if (n6 === null) throw new Error('Error en MAIL FROM');
      response = decoder.decode(buffer.subarray(0, n6));

      // RCPT TO
      await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
      const n7 = await conn.read(buffer);
      if (n7 === null) throw new Error('Error en RCPT TO');
      response = decoder.decode(buffer.subarray(0, n7));

      // DATA
      await conn.write(encoder.encode(`DATA\r\n`));
      const n8 = await conn.read(buffer);
      if (n8 === null) throw new Error('Error en DATA');
      response = decoder.decode(buffer.subarray(0, n8));

      // Enviar mensaje
      const emailContent = [
        `From: ${SMTP_CONFIG.fromName} <${SMTP_CONFIG.from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
        `.`,
      ].join('\r\n');

      await conn.write(encoder.encode(emailContent + '\r\n'));
      const n9 = await conn.read(buffer);
      if (n9 === null) throw new Error('Error enviando mensaje');
      response = decoder.decode(buffer.subarray(0, n9));

      // QUIT
      await conn.write(encoder.encode(`QUIT\r\n`));
      
      conn.close();
      
      return { success: true };
    } catch (smtpError: any) {
      conn.close();
      throw smtpError;
    }
  } catch (error: any) {
    console.error('Error SMTP:', error);
    return { success: false, error: error.message || 'Error desconocido en SMTP' };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Obtener documentos que necesitan notificación (10 o 5 días antes)
    const { data: pendingNotifications, error: pendingError } = await supabaseClient
      .rpc('get_pending_notifications');

    if (pendingError) {
      return new Response(
        JSON.stringify({ error: 'Error obteniendo notificaciones pendientes', details: pendingError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay documentos próximos a vencer que requieran notificación',
          sent: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Preparar y enviar emails (igual que backend: un email por documento)
    const sentNotifications = [];
    const failedNotifications = [];

    // Función helper para obtener nombre del documento
    const getDocumentLabel = (type: string) => {
      const labels: Record<string, string> = {
        tecno: 'Revisión Técnico-Mecánica',
        soat: 'SOAT',
        poliza: 'Póliza de Seguro',
        licencia: 'Licencia de Conducción',
      };
      return labels[type] || type;
    };

    // Función para generar HTML del email (igual que backend)
    const generateEmailHTML = (doc: any) => {
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
      `.trim();
    };

    // Enviar un email por cada documento (igual que backend)
    for (const doc of pendingNotifications) {
      const recipients = doc.department === 'transport' 
        ? EMAIL_RECIPIENTS.transport 
        : EMAIL_RECIPIENTS.logistics;
      
      const recipientList = recipients.join(', ');

      const docLabel = getDocumentLabel(doc.document_type);
      const urgency = doc.days_until_expiration === 5 ? 'URGENTE' : 'ALERTA';
      
      const emailSubject = `⚠️ ${urgency}: ${docLabel} vence en ${doc.days_until_expiration} días - ${doc.license_plate}`;
      const emailBody = generateEmailHTML(doc);

      try {
        // Enviar a todos los destinatarios del departamento
        let allSent = true;
        let lastError = '';

        for (const recipient of recipients) {
          const emailResult = await sendEmailSMTP(recipient, emailSubject, emailBody);
          
          if (!emailResult.success) {
            allSent = false;
            lastError = emailResult.error || 'Error desconocido';
            console.error(`❌ Error enviando a ${recipient}:`, lastError);
          }
        }

        if (allSent) {
          // Registrar en BD
          await supabaseClient.from('email_notifications').insert({
            equipment_id: doc.equipment_id,
            document_type: doc.document_type,
            expiration_date: doc.expiration_date,
            notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
            sent_to: recipientList,
            email_subject: emailSubject,
            email_body: emailBody,
            status: 'sent',
          });

          sentNotifications.push({
            equipment_id: doc.equipment_id,
            license_plate: doc.license_plate,
            document_type: doc.document_type,
            notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          });

          console.log(`✅ Email enviado: ${doc.license_plate} → ${recipientList}`);
        } else {
          // Registrar como fallido
          await supabaseClient.from('email_notifications').insert({
            equipment_id: doc.equipment_id,
            document_type: doc.document_type,
            expiration_date: doc.expiration_date,
            notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
            sent_to: recipientList,
            email_subject: emailSubject,
            status: 'failed',
            error_message: lastError,
          });

          failedNotifications.push({
            equipment_id: doc.equipment_id,
            license_plate: doc.license_plate,
            document_type: doc.document_type,
            notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
            error: lastError,
          });
        }
      } catch (error: any) {
        console.error(`❌ Error enviando email para ${doc.license_plate}:`, error);
        
        // Registrar como fallido
        await supabaseClient.from('email_notifications').insert({
          equipment_id: doc.equipment_id,
          document_type: doc.document_type,
          expiration_date: doc.expiration_date,
          notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          sent_to: recipientList,
          email_subject: emailSubject,
          status: 'failed',
          error_message: error.message,
        });

        failedNotifications.push({
          equipment_id: doc.equipment_id,
          license_plate: doc.license_plate,
          document_type: doc.document_type,
          notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentNotifications.length,
        failed: failedNotifications.length,
        sent_notifications: sentNotifications,
        failed_notifications: failedNotifications,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

