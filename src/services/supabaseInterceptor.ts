import { supabase } from './supabase';
import { forceConnectionValidation } from './connectionManager';

/**
 * Interceptor global para Supabase que maneja automáticamente:
 * - Refresh de tokens expirados
 * - Retry automático de queries fallidas
 * - Mejor manejo de errores
 * - Reconexión automática después de timeouts
 */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;

/**
 * Verificar si hay sesión activa de forma rápida
 * Mejorado: No bloquear en validación de conexión
 */
const checkSessionQuick = async (): Promise<boolean> => {
  // Simplificado: usar timeout muy corto (2 segundos) y ser permisivo
  // Si getSession() tarda, asumir que hay sesión para no bloquear queries
  try {
    const { data: { session }, error } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: any }; error: any }>((resolve) => 
        setTimeout(() => resolve({ data: { session: null }, error: null }), 2000)
      )
    ]);
    
    // Si hay error o timeout, ser permisivo y asumir que hay sesión
    // La query fallará con error de auth si realmente no hay sesión
    if (error || !session) {
      return true; // Ser permisivo para no bloquear queries
    }
    
    return !!session;
  } catch (error) {
    // Ser permisivo: si hay error, asumir que hay sesión
    return true;
  }
};

/**
 * Refrescar sesión de Supabase con mejor manejo de errores
 * Mejorado con validación de conexión y reconexión automática
 */
const refreshSession = async (): Promise<boolean> => {
  // Si ya hay un refresh en progreso, esperar a que termine
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      console.log('🔄 Refrescando sesión de Supabase...');
      
      // Validar conexión de forma no bloqueante (con timeout corto)
      // No esperar el resultado, solo iniciar la validación
      forceConnectionValidation().catch(() => {
        // Ignorar errores de validación
      });
      
      // Verificar sesión de forma rápida (con timeout corto)
      // No esperar el resultado, solo iniciar la verificación
      checkSessionQuick().catch(() => {
        // Ignorar errores de verificación
      });
      
      // Ser permisivo: intentar refrescar de todas formas
      // (puede ser que la sesión esté en localStorage pero no se haya cargado aún)

      // Refrescar con timeout más largo (15 segundos) para manejar mejor la inactividad
      const { data, error } = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<{ data: any; error: any }>((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), 15000)
        )
      ]);
      
      if (error) {
        console.error('❌ Error al refrescar sesión:', error);
        isRefreshing = false;
        refreshPromise = null;
        connectionRetryCount = 0;
        return false;
      }

      if (data.session) {
        console.log('✅ Sesión refrescada exitosamente');
        isRefreshing = false;
        refreshPromise = null;
        connectionRetryCount = 0; // Reset contador en éxito
        return true;
      }

      isRefreshing = false;
      refreshPromise = null;
      return false;
    } catch (error: any) {
      console.error('❌ Excepción al refrescar sesión:', error);
      isRefreshing = false;
      refreshPromise = null;
      
      // Si es timeout, incrementar contador
      if (error?.message?.includes('timeout')) {
        connectionRetryCount++;
        if (connectionRetryCount >= MAX_RETRY_COUNT) {
          console.error('❌ Máximo de reintentos alcanzado, cerrando sesión para limpiar estado');
          try {
            await supabase.auth.signOut();
          } catch {
            // Ignorar error de signOut
          }
          connectionRetryCount = 0;
        }
      }
      
      return false;
    }
  })();

  return refreshPromise;
};

/**
 * Verificar si un error es de autenticación
 */
const isAuthError = (error: any): boolean => {
  if (!error) return false;
  
  // Códigos de error de Supabase relacionados con autenticación
  const authErrorCodes = ['PGRST301', 'PGRST116', '42501'];
  const authErrorMessages = ['JWT', 'token', 'unauthorized', 'forbidden', 'expired'];
  
  if (error.code && authErrorCodes.includes(error.code)) {
    return true;
  }
  
  if (error.message) {
    const message = error.message.toLowerCase();
    return authErrorMessages.some(keyword => message.includes(keyword));
  }
  
  // Verificar status HTTP
  if (error.status === 401 || error.status === 403) {
    return true;
  }
  
  return false;
};

/**
 * Tipo de respuesta de Supabase (puede incluir count)
 */
type SupabaseResponse<T> = { 
  data: T | null; 
  error: any; 
  count?: number | null;
};

/**
 * Ejecutar una query de Supabase con auto-refresh y retry
 * Maneja tanto queries simples como queries con count
 * Mejorado con timeout reducido y mejor reconexión
 */
export const executeSupabaseQuery = async <T>(
  queryFn: () => Promise<SupabaseResponse<T>>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    autoRefresh?: boolean;
    timeout?: number;
  } = {}
): Promise<SupabaseResponse<T>> => {
  // Aumentar timeout a 30 segundos para manejar mejor la inactividad
  // Después de 10 minutos de inactividad, las queries pueden tardar más
  const { maxRetries = 3, retryDelay = 1000, autoRefresh = true, timeout = 30000 } = options;
  
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Verificar sesión antes de ejecutar (solo en primer intento, y de forma no bloqueante)
      // Simplificado: no bloquear en verificación de sesión, dejar que la query se ejecute
      // Si realmente no hay sesión, la query fallará con error de auth que se manejará apropiadamente
      if (attempt === 0 && autoRefresh) {
        // Intentar validar conexión en background (no bloqueante)
        forceConnectionValidation().catch(() => {
          // Ignorar errores, continuar
        });
        
        // Verificar sesión de forma no bloqueante (con timeout muy corto)
        // No esperar el resultado, solo iniciar la verificación en background
        checkSessionQuick().then(hasSession => {
          if (!hasSession) {
            // Intentar refrescar en background (no bloqueante)
            refreshSession().catch(() => {
              // Ignorar errores de refresh en background
            });
          }
        }).catch(() => {
          // Ignorar errores de verificación en background
        });
        
        // No esperar la verificación, continuar inmediatamente con la query
        // Esto evita bloquear las queries mientras se verifica la sesión
      }

      // Timeout para evitar queries colgadas
      // Después de inactividad, las queries pueden tardar más, así que usar el timeout configurado
      const timeoutPromise = new Promise<SupabaseResponse<T>>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout: La consulta tardó más de ${timeout}ms`)), timeout)
      );

      const queryPromise = (async () => {
        // Ejecutar la query directamente
        const result = await queryFn();
        
        // Si hay error de autenticación y auto-refresh está habilitado
        if (result.error && isAuthError(result.error) && autoRefresh && attempt < maxRetries) {
          console.log(`🔄 Error de autenticación detectado (intento ${attempt + 1}/${maxRetries + 1}), refrescando sesión...`);
          
          const refreshed = await refreshSession();
          if (refreshed) {
            // Esperar un poco antes de reintentar
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            lastError = result.error;
            throw new Error('RETRY_AUTH_ERROR'); // Lanzar error especial para reintentar
          } else {
            throw result.error;
          }
        }
        
        // Si hay error pero no es de autenticación, o ya se agotaron los reintentos
        if (result.error) {
          throw result.error;
        }
        
        // Éxito - reset contador
        connectionRetryCount = 0;
        return result;
      })();

      // Ejecutar con timeout
      return await Promise.race([queryPromise, timeoutPromise]);
    } catch (error: any) {
      lastError = error;
      
      // Si es el error especial de retry de autenticación, continuar el loop
      if (error?.message === 'RETRY_AUTH_ERROR' && attempt < maxRetries) {
        continue;
      }
      
      // Si es timeout, intentar refrescar sesión en background (no bloqueante) y reintentar query inmediatamente
      if (error?.message?.includes('Timeout') && attempt < maxRetries && autoRefresh) {
        console.log(`⏱️ Timeout detectado (intento ${attempt + 1}/${maxRetries + 1}), reintentando query...`);
        
        // Intentar refrescar sesión en background (no bloqueante)
        // No esperar el resultado, simplemente iniciar el refresh y continuar
        refreshSession().catch(() => {
          // Ignorar errores de refresh en background
        });
        
        // Esperar un poco antes de reintentar (dar tiempo a que la conexión se estabilice)
        await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
        continue; // Reintentar inmediatamente sin esperar el refresh
      }
      
      // Si es error de autenticación y aún hay reintentos disponibles
      if (isAuthError(error) && autoRefresh && attempt < maxRetries) {
        console.log(`🔄 Error de autenticación (intento ${attempt + 1}/${maxRetries + 1}), refrescando sesión...`);
        
        const refreshed = await refreshSession();
        if (refreshed) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Reintentar
        }
      }
      
      // Si es timeout y no se pudo reconectar, lanzar error
      if (error?.message?.includes('Timeout')) {
        console.error('⏱️ Timeout en query de Supabase después de todos los reintentos');
        // Forzar sign out para limpiar sesión atascada y permitir login limpio
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignorar error de signOut
        }
        throw error;
      }
      
      // Si no es error de autenticación o se agotaron los reintentos, lanzar error
      if (attempt === maxRetries || !isAuthError(error) || !autoRefresh) {
        throw error;
      }
    }
  }
  
  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError;
};

/**
 * Wrapper para queries de Supabase con manejo automático de errores
 */
export const safeSupabaseQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<T> => {
  const result = await executeSupabaseQuery(queryFn);
  
  if (result.error) {
    throw result.error;
  }
  
  if (result.data === null) {
    throw new Error('No data returned from query');
  }
  
  return result.data;
};

