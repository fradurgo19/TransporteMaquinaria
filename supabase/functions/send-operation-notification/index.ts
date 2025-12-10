// Supabase Edge Function para enviar notificaciones por email de operaciones usando SMTP Gmail
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OperationNotificationRequest {
  operation_id: string;
}

// Configuración SMTP Gmail (sincronizada con backend)
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'fradurgo19@gmail.com',
  pass: 'asovvyyfobpuzzvd', // Contraseña del backend
  from: 'fradurgo19@gmail.com',
  fromName: 'Partequipos - Sistema de Transporte',
};

// Destinatarios para notificaciones de operaciones (igual que backend)
const EMAIL_RECIPIENTS = {
  transport: 'logisticamq1@partequipos.com',
  logistics: 'bodega.medellin@partequipos.com',
};

const COMPANY_LOGO = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

// Función para enviar email usando SMTP vía API HTTP (más confiable en Edge Functions)
const sendEmailSMTP = async (to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Usar un servicio SMTP HTTP o implementar SMTP directamente
    // Para Edge Functions, usaremos un enfoque con fetch a un servicio SMTP HTTP
    // Alternativa: usar la API de Gmail directamente con OAuth2
    
    // Implementación usando EmailJS o similar, o mejor, usar directamente SMTP
    // Por ahora, usaremos un método que funcione con Gmail SMTP
    
    // Construir el mensaje
    const message = {
      from: `${SMTP_CONFIG.fromName} <${SMTP_CONFIG.from}>`,
      to: to,
      subject: subject,
      html: html,
    };

    // Usar un servicio SMTP HTTP como alternativa
    // O implementar SMTP directamente usando conexión TCP con TLS
    
    // Método más simple: usar un servicio SMTP HTTP proxy
    // O implementar SMTP manualmente
    
    // Por ahora, usaremos un enfoque con fetch a un servicio que envuelva SMTP
    // O mejor, usar directamente la API REST de Gmail
    
    // Implementación directa con SMTP usando conexión TCP
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Conectar a SMTP
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
      console.log('AUTH LOGIN:', response);

      // Enviar usuario (base64)
      const userB64 = btoa(SMTP_CONFIG.user);
      await conn.write(encoder.encode(`${userB64}\r\n`));
      const n4 = await conn.read(buffer);
      if (n4 === null) throw new Error('Error en usuario');
      response = decoder.decode(buffer.subarray(0, n4));
      console.log('Usuario:', response);

      // Enviar contraseña (base64)
      const passB64 = btoa(SMTP_CONFIG.pass);
      await conn.write(encoder.encode(`${passB64}\r\n`));
      const n5 = await conn.read(buffer);
      if (n5 === null) throw new Error('Error en contraseña');
      response = decoder.decode(buffer.subarray(0, n5));
      console.log('Contraseña:', response);

      if (!response.startsWith('235')) {
        throw new Error(`Autenticación fallida: ${response}`);
      }

      // MAIL FROM
      await conn.write(encoder.encode(`MAIL FROM:<${SMTP_CONFIG.from}>\r\n`));
      const n6 = await conn.read(buffer);
      if (n6 === null) throw new Error('Error en MAIL FROM');
      response = decoder.decode(buffer.subarray(0, n6));
      console.log('MAIL FROM:', response);

      // RCPT TO
      await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
      const n7 = await conn.read(buffer);
      if (n7 === null) throw new Error('Error en RCPT TO');
      response = decoder.decode(buffer.subarray(0, n7));
      console.log('RCPT TO:', response);

      // DATA
      await conn.write(encoder.encode(`DATA\r\n`));
      const n8 = await conn.read(buffer);
      if (n8 === null) throw new Error('Error en DATA');
      response = decoder.decode(buffer.subarray(0, n8));
      console.log('DATA:', response);

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
      console.log('Mensaje:', response);

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

    const { operation_id }: OperationNotificationRequest = await req.json();

    if (!operation_id) {
      return new Response(
        JSON.stringify({ error: 'operation_id es requerido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Obtener información de la operación
    const { data: operation, error: operationError } = await supabaseClient
      .from('operations')
      .select('*')
      .eq('id', operation_id)
      .single();

    if (operationError || !operation) {
      return new Response(
        JSON.stringify({ error: 'Operación no encontrada', details: operationError }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Obtener destinatarios
    const { data: recipients, error: recipientsError } = await supabaseClient
      .rpc('get_operation_notification_recipients', { operation_id_param: operation_id });

    if (recipientsError || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se encontraron destinatarios', details: recipientsError }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Preparar contenido del email
    const operationTypeLabels: Record<string, string> = {
      loading: 'Carga',
      route_start: 'Inicio de Recorrido',
      delivery: 'Entrega',
    };

    const operationType = operationTypeLabels[operation.operation_type] || operation.operation_type;
    const vehiclePlate = operation.vehicle_plate;
    const equipmentSerial = operation.equipment_serial || 'N/A';
    const origin = operation.origin || 'N/A';
    const destination = operation.destination || 'N/A';
    const timestamp = new Date(operation.operation_timestamp).toLocaleString('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const emailSubject = `Nueva Operación: ${operationType} - Vehículo ${vehiclePlate}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 5px; }
    .label { font-weight: bold; color: #2563eb; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🚛 Nueva Operación Registrada</h2>
    </div>
    <div class="content">
      <div class="detail-row">
        <span class="label">Tipo de Operación:</span> ${operationType}
      </div>
      <div class="detail-row">
        <span class="label">Vehículo:</span> ${vehiclePlate}
      </div>
      <div class="detail-row">
        <span class="label">Serie del Equipo:</span> ${equipmentSerial}
      </div>
      <div class="detail-row">
        <span class="label">Conductor:</span> ${operation.driver_name}
      </div>
      <div class="detail-row">
        <span class="label">Origen:</span> ${origin}
      </div>
      <div class="detail-row">
        <span class="label">Destino:</span> ${destination}
      </div>
      <div class="detail-row">
        <span class="label">Fecha y Hora:</span> ${timestamp}
      </div>
      ${operation.notes ? `
      <div class="detail-row">
        <span class="label">Notas:</span> ${operation.notes}
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="label">Ubicación GPS:</span> 
        Lat: ${operation.gps_latitude}, Lng: ${operation.gps_longitude}
      </div>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático del Sistema de Gestión de Transporte de Maquinaria.</p>
      <p>Partequipos S.A.S</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // 4. Enviar emails a todos los destinatarios
    const sentNotifications = [];
    const failedNotifications = [];

    // Siempre enviar a logisticamq1@partequipos.com además de los destinatarios
    const allRecipients = [
      ...recipients,
      { email: 'logisticamq1@partequipos.com', full_name: 'Logística Partequipos', role: 'admin' }
    ];

    // Eliminar duplicados
    const uniqueRecipients = Array.from(
      new Map(allRecipients.map(r => [r.email, r])).values()
    );

    for (const recipient of uniqueRecipients) {
      try {
        const emailResult = await sendEmailSMTP(recipient.email, emailSubject, emailBody);
        
        if (emailResult.success) {
          await supabaseClient
            .from('operation_notifications')
            .insert({
              operation_id: operation_id,
              sent_to: recipient.email,
              email_subject: emailSubject,
              email_body: emailBody,
              status: 'sent',
            });

          sentNotifications.push(recipient.email);
          console.log(`✅ Email enviado a ${recipient.email}`);
        } else {
          await supabaseClient
            .from('operation_notifications')
            .insert({
              operation_id: operation_id,
              sent_to: recipient.email,
              email_subject: emailSubject,
              email_body: emailBody,
              status: 'failed',
              error_message: emailResult.error || 'Error al enviar email',
            });

          failedNotifications.push({
            email: recipient.email,
            error: emailResult.error,
          });
          console.error(`❌ Error enviando email a ${recipient.email}:`, emailResult.error);
        }
      } catch (error: any) {
        await supabaseClient
          .from('operation_notifications')
          .insert({
            operation_id: operation_id,
            sent_to: recipient.email,
            email_subject: emailSubject,
            email_body: emailBody,
            status: 'failed',
            error_message: error.message || 'Error desconocido',
          });

        failedNotifications.push({
          email: recipient.email,
          error: error.message,
        });
        console.error(`❌ Excepción enviando email a ${recipient.email}:`, error);
      }
    }

    // 5. Marcar operación como notificada
    if (sentNotifications.length > 0) {
      await supabaseClient.rpc('mark_operation_notified', {
        operation_id_param: operation_id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        operation_id: operation_id,
        sent: sentNotifications.length,
        failed: failedNotifications.length,
        sent_to: sentNotifications,
        failed_to: failedNotifications,
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
