import { supabase } from './supabase';
import { withConnectionCheck, forceConnectionValidation } from './connectionManager';

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
  try {
    // Intentar validar conexión en background (no bloqueante)
    forceConnectionValidation().catch(() => {
      // Ignorar errores de validación, continuar con verificación de sesión
    });
    
    const { data: { session } } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: any } }>((_, reject) => 
        setTimeout(() => reject(new Error('Session check timeout')), 3000)
      )
    ]);
    return !!session;
  } catch {
    return false;
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
      
      // Asegurar conexión antes de refrescar
      const connected = await forceConnectionValidation();
      if (!connected) {
        console.warn('⚠️ No se pudo validar conexión, no se puede refrescar sesión');
        isRefreshing = false;
        refreshPromise = null;
        return false;
      }
      
      // Verificar primero si hay sesión antes de refrescar
      const hasSession = await checkSessionQuick();
      if (!hasSession) {
        console.warn('⚠️ No hay sesión para refrescar');
        isRefreshing = false;
        refreshPromise = null;
        return false;
      }

      // Refrescar con timeout más corto (sin withConnectionCheck para evitar bloqueos)
      const { data, error } = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<{ data: any; error: any }>((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), 8000)
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
          console.error('❌ Máximo de reintentos alcanzado, limpiando estado');
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
  const { maxRetries = 2, retryDelay = 500, autoRefresh = true, timeout = 15000 } = options; // Timeout reducido a 15s
  
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Verificar sesión antes de ejecutar (solo en primer intento)
      // No bloquear en validación de conexión
      if (attempt === 0 && autoRefresh) {
        // Intentar validar conexión en background (no bloqueante)
        forceConnectionValidation().catch(() => {
          // Ignorar errores, continuar con verificación de sesión
        });
        
        const hasSession = await checkSessionQuick();
        if (!hasSession) {
          console.log('🔄 No hay sesión activa, intentando refrescar...');
          const refreshed = await refreshSession();
          if (!refreshed) {
            throw new Error('No hay sesión activa y no se pudo refrescar');
          }
        }
      }

      // Timeout más agresivo para evitar queries colgadas
      const timeoutPromise = new Promise<SupabaseResponse<T>>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout: La consulta tardó más de ${timeout}ms`)), timeout)
      );

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d4879519-de5c-448a-afc8-ae289d861d74',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseInterceptor.ts:177',message:'Starting query execution',data:{attempt,timeout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion

      const queryPromise = (async () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d4879519-de5c-448a-afc8-ae289d861d74',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseInterceptor.ts:181',message:'Query function called',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Ejecutar la query directamente
        const result = await queryFn();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d4879519-de5c-448a-afc8-ae289d861d74',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseInterceptor.ts:184',message:'Query function completed',data:{attempt,hasError:!!result.error,errorCode:result.error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d4879519-de5c-448a-afc8-ae289d861d74',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseInterceptor.ts:208',message:'Query error caught',data:{attempt,errorMessage:error?.message,errorName:error?.name,isTimeout:error?.message?.includes('Timeout'),isAuthError:isAuthError(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      
      // Si es el error especial de retry de autenticación, continuar el loop
      if (error?.message === 'RETRY_AUTH_ERROR' && attempt < maxRetries) {
        continue;
      }
      
      // Si es timeout, intentar refrescar sesión antes de reintentar
      if (error?.message?.includes('Timeout') && attempt < maxRetries && autoRefresh) {
        console.log(`⏱️ Timeout detectado (intento ${attempt + 1}/${maxRetries + 1}), intentando reconectar...`);
        
        // Intentar refrescar sesión antes de reintentar
        const refreshed = await refreshSession();
        if (refreshed) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Reintentar después de refrescar
        }
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

