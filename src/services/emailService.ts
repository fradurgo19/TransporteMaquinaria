import { supabase } from './supabase';

const EMAIL_RECIPIENTS = {
  transport: 'logisticamq1@partequipos.com',
  logistics: 'bodega.medellin@partequipos.com',
};

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'fradurgo19@gmail.com',
    pass: 'asovvyyfobpuzzvd', // App password
  },
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
  notification_type: '10_days' | '5_days';
  department?: string;
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

          <!-- Badge de urgencia -->
          <tr>
            <td style="padding: 30px 30px 20px; text-align: center;">
              <div style="display: inline-block; background-color: ${urgencyColor}; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 18px;">
                ${urgencyText} - Documento por vencer
              </div>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding: 20px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Estimado Equipo de ${departmentLabel},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Le informamos que el siguiente documento está próximo a vencer en <strong style="color: ${urgencyColor};">${doc.days_until_expiration} días</strong>:
              </p>

              <!-- Información del vehículo -->
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

          <!-- Footer -->
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
  `.trim();
};

/**
 * Obtener documentos pendientes de notificación
 */
export const getPendingNotifications = async (): Promise<DocumentExpiring[]> => {
  const { data, error } = await supabase.rpc('get_pending_notifications');

  if (error) {
    console.error('Error obteniendo notificaciones pendientes:', error);
    throw error;
  }

  return data || [];
};

/**
 * Enviar email de notificación (simulado - requiere configuración de email en producción)
 */
export const sendExpirationEmail = async (doc: DocumentExpiring): Promise<boolean> => {
  try {
    const recipient = doc.department === 'transport' 
      ? EMAIL_RECIPIENTS.transport 
      : EMAIL_RECIPIENTS.logistics;

    const subject = `⚠️ ${doc.days_until_expiration === 5 ? 'URGENTE' : 'ALERTA'}: ${getDocumentLabel(doc.document_type)} vence en ${doc.days_until_expiration} días - ${doc.license_plate}`;
    const htmlBody = generateEmailHTML(doc);

    console.log('📧 Preparando email:', {
      to: recipient,
      subject,
      department: doc.department,
      preview: `${doc.license_plate} - ${getDocumentLabel(doc.document_type)}`,
    });

    // Llamar a Edge Function de Supabase para enviar email
    // En producción, esto llamará a la Edge Function que usa SMTP
    const { data, error: funcError } = await supabase.functions.invoke('send-expiration-alerts', {
      body: {
        doc,
        recipient,
        subject,
        html: htmlBody,
      },
    });

    if (funcError) {
      console.error('Error en Edge Function:', funcError);
      // Fallback: registrar como pendiente
      await supabase.from('email_notifications').insert({
        equipment_id: doc.equipment_id,
        document_type: doc.document_type,
        expiration_date: doc.expiration_date,
        notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
        sent_to: recipient,
        email_subject: subject,
        email_body: htmlBody,
        status: 'failed',
      });
      return false;
    }

    // Registrar notificación enviada
    const { error } = await supabase
      .from('email_notifications')
      .insert({
        equipment_id: doc.equipment_id,
        document_type: doc.document_type,
        expiration_date: doc.expiration_date,
        notification_type: doc.days_until_expiration === 10 ? '10_days' : '5_days',
        sent_to: recipient,
        email_subject: subject,
        email_body: htmlBody,
        status: 'sent',
      });

    if (error) {
      console.error('Error registrando notificación:', error);
    }

    console.log('✅ Email enviado exitosamente a:', recipient);
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
};

/**
 * Procesar todas las notificaciones pendientes
 */
export const processExpirationNotifications = async (): Promise<{
  sent: number;
  failed: number;
}> => {
  try {
    const pendingDocs = await getPendingNotifications();
    
    if (pendingDocs.length === 0) {
      console.log('✅ No hay notificaciones pendientes');
      return { sent: 0, failed: 0 };
    }

    console.log(`📧 Procesando ${pendingDocs.length} notificaciones...`);

    let sent = 0;
    let failed = 0;

    for (const doc of pendingDocs) {
      const success = await sendExpirationEmail(doc);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    console.log(`✅ Notificaciones procesadas: ${sent} enviadas, ${failed} fallidas`);
    return { sent, failed };
  } catch (error) {
    console.error('Error procesando notificaciones:', error);
    return { sent: 0, failed: 0 };
  }
};

