import { supabase } from './supabase';

/**
 * Gestor de sesión para mantener la sesión activa y refrescar tokens proactivamente
 * Resuelve el problema de datos que no cargan después de inactividad
 */

let heartbeatInterval: NodeJS.Timeout | null = null;
let lastRefreshTime = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // Refrescar cada 5 minutos
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // Heartbeat cada 2 minutos

/**
 * Verificar y refrescar sesión si es necesario
 */
export const refreshSessionIfNeeded = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error obteniendo sesión:', error);
      return false;
    }

    if (!session) {
      console.warn('⚠️ No hay sesión activa');
      return false;
    }

    // Verificar si el token expira pronto (en menos de 10 minutos)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;

    // Si el token expira en menos de 10 minutos, refrescarlo
    if (timeUntilExpiry < 600) {
      console.log('🔄 Token expira pronto, refrescando sesión...');
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Error refrescando sesión:', refreshError);
        return false;
      }

      if (data.session) {
        console.log('✅ Sesión refrescada exitosamente');
        lastRefreshTime = Date.now();
        return true;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Excepción en refreshSessionIfNeeded:', error);
    return false;
  }
};

/**
 * Iniciar heartbeat para mantener la sesión activa
 */
export const startSessionHeartbeat = () => {
  // Limpiar intervalo existente si hay uno
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  console.log('💓 Iniciando heartbeat de sesión...');

  // Refrescar inmediatamente
  refreshSessionIfNeeded();

  // Configurar intervalo para refrescar periódicamente
  heartbeatInterval = setInterval(async () => {
    const now = Date.now();
    
    // Solo refrescar si han pasado al menos REFRESH_INTERVAL desde el último refresh
    if (now - lastRefreshTime >= REFRESH_INTERVAL) {
      await refreshSessionIfNeeded();
    } else {
      // Si no es tiempo de refrescar, solo verificar que la sesión esté activa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ Sesión perdida, intentando refrescar...');
        await refreshSessionIfNeeded();
      }
    }
  }, HEARTBEAT_INTERVAL);
};

/**
 * Detener heartbeat
 */
export const stopSessionHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('🛑 Heartbeat de sesión detenido');
  }
};

/**
 * Verificar sesión antes de ejecutar una operación crítica
 */
export const ensureActiveSession = async (): Promise<boolean> => {
  const refreshed = await refreshSessionIfNeeded();
  
  if (!refreshed) {
    // Intentar una vez más
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }
  
  return true;
};

