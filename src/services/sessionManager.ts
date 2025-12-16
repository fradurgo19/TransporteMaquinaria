import { supabase } from './supabase';
import { forceConnectionValidation, shouldValidateConnection } from './connectionManager';

/**
 * Gestor de sesión para mantener la sesión activa y refrescar tokens proactivamente
 * Resuelve el problema de datos que no cargan después de inactividad
 */

let heartbeatInterval: NodeJS.Timeout | null = null;
let lastRefreshTime = 0;
let isRefreshing = false; // Lock para evitar múltiples refreshes simultáneos
const REFRESH_INTERVAL = 3 * 60 * 1000; // Refrescar cada 3 minutos (más frecuente)
const HEARTBEAT_INTERVAL = 1 * 60 * 1000; // Heartbeat cada 1 minuto (más frecuente)
const TOKEN_EXPIRY_THRESHOLD = 20 * 60; // Refrescar si expira en menos de 20 minutos (más proactivo)

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

    // Verificar si el token expira pronto (en menos de 20 minutos)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;

    // Si el token expira en menos de 20 minutos Y no se ha refrescado recientemente, refrescarlo
    if (timeUntilExpiry < TOKEN_EXPIRY_THRESHOLD && (Date.now() - lastRefreshTime) > 30000) {
      // Activar lock
      isRefreshing = true;
      
      try {
        console.log('🔄 Token expira pronto, refrescando sesión...');
        
        // Timeout más corto para refresh (10 segundos) para evitar bloqueos
        const refreshTimeoutPromise = new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout refrescando sesión')), 10000)
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
    
    try {
      // Intentar validar conexión en background (no bloqueante)
      if (shouldValidateConnection()) {
        forceConnectionValidation().catch(() => {
          // Ignorar errores, continuar con verificación de sesión
        });
      }
      
      // Verificar sesión primero (rápido) con timeout más largo
      const { data: { session }, error } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: any }; error: any }>((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        )
      ]);

      if (error || !session) {
        console.warn('⚠️ Sesión perdida o error, intentando refrescar...');
        await refreshSessionIfNeeded();
        return;
      }

      // Solo refrescar si han pasado al menos REFRESH_INTERVAL desde el último refresh
      if (now - lastRefreshTime >= REFRESH_INTERVAL) {
        await refreshSessionIfNeeded();
      }
    } catch (error) {
      // Si hay error verificando sesión, intentar refrescar (no bloquear en validación)
      console.warn('⚠️ Error verificando sesión en heartbeat, intentando refrescar...');
      
      // Intentar refrescar sin bloquear en validación de conexión
      refreshSessionIfNeeded().catch(() => {
        // Ignorar errores, continuar en próximo ciclo
      });
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

