import { supabase } from './supabase';

/**
 * Enviar notificaciones por email para una operación
 * @param operationId ID de la operación
 * @returns Resultado del envío de notificaciones
 */
export const sendOperationNotification = async (operationId: string) => {
  try {
    console.log('📧 Enviando notificaciones para operación:', operationId);

    // Llamar al backend Node.js
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/send-operation-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation_id: operationId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Notificaciones enviadas:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Error en sendOperationNotification:', error);
    throw error;
  }
};

/**
 * Obtener historial de notificaciones de una operación
 */
export const getOperationNotifications = async (operationId: string) => {
  try {
    const { data, error } = await supabase
      .from('operation_notifications')
      .select('*')
      .eq('operation_id', operationId)
      .order('sent_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error obteniendo notificaciones:', error);
    throw error;
  }
};

