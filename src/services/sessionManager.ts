import { supabase } from './supabase';

/**
 * Gestor de sesión para mantener la sesión activa y refrescar tokens proactivamente
 * Resuelve el problema de datos que no cargan después de inactividad
 */

let heartbeatInterval: NodeJS.Timeout | null = null;
let lastRefreshTime = 0;
let isRefreshing = false; // Lock para evitar múltiples refreshes simultáneos
const REFRESH_INTERVAL = 5 * 60 * 1000; // Refrescar cada 5 minutos
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // Heartbeat cada 2 minutos

/**
 * Verificar y refrescar sesión si es necesario
 * Mejorado para manejar mejor la reconexión después de inactividad
 * Con lock para evitar múltiples refreshes simultáneos
 */
export const refreshSessionIfNeeded = async (): Promise<boolean> => {
  // Si ya hay un refresh en progreso, esperar un momento y verificar sesión directamente
  if (isRefreshing) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch {
      return false;
    }
  }

  try {
    // Verificar sesión primero (sin timeout agresivo)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('⚠️ Error obteniendo sesión:', error);
      return false;
    }

    if (!session) {
      console.warn('⚠️ No hay sesión activa');
      return false;
    }

    // Verificar si el token expira pronto (en menos de 15 minutos)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;

    // Si el token expira en menos de 15 minutos Y no se ha refrescado recientemente, refrescarlo
    if (timeUntilExpiry < 900 && (Date.now() - lastRefreshTime) > 60000) {
      // Activar lock
      isRefreshing = true;
      
      try {
        console.log('🔄 Token expira pronto, refrescando sesión...');
        
        // Timeout más largo para refresh (15 segundos)
        const refreshTimeoutPromise = new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout refrescando sesión')), 15000)
        );

        const refreshPromise = (async () => {
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.warn('⚠️ Error refrescando sesión:', refreshError);
            return false;
          }

          if (data.session) {
            console.log('✅ Sesión refrescada exitosamente');
            lastRefreshTime = Date.now();
            return true;
          }
          
          return false;
        })();

        try {
          const refreshed = await Promise.race([refreshPromise, refreshTimeoutPromise]);
          return refreshed;
        } catch (refreshError) {
          // Si falla el refresh pero tenemos sesión, retornar true para permitir continuar
          console.warn('⚠️ Timeout al refrescar sesión, pero hay sesión activa - continuando');
          return true;
        } finally {
          isRefreshing = false;
        }
      } catch (error) {
        isRefreshing = false;
        // Si hay error pero tenemos sesión, continuar
        return true;
      }
    }

    return true;
  } catch (error) {
    console.warn('⚠️ Excepción en refreshSessionIfNeeded:', error);
    // Intentar verificar si hay sesión aunque haya fallado el refresh
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch {
      return false;
    }
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
 * Versión simplificada - solo verifica sesión, no intenta refresh
 */
export const ensureActiveSession = async (): Promise<boolean> => {
  try {
    // Verificar sesión directamente (rápido y simple)
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    // Si falla, asumir que no hay sesión
    return false;
  }
};

