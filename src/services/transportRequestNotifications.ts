/**
 * Enviar notificaciones por email para solicitudes de transporte
 * @param requestId ID de la solicitud de transporte
 * @returns Resultado del envío de notificaciones
 */
export const sendTransportRequestNotification = async (requestId: string) => {
  try {
    console.log('📧 Enviando notificaciones para solicitud de transporte:', requestId);

    // Llamar al backend Node.js
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/send-transport-request-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request_id: requestId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Notificaciones enviadas:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Error en sendTransportRequestNotification:', error);
    throw error;
  }
};

