import { supabase } from './supabase';
import { ensureActiveSession } from './sessionManager';

/**
 * Interceptor global para Supabase que maneja automáticamente:
 * - Refresh de tokens expirados
 * - Retry automático de queries fallidas
 * - Mejor manejo de errores
 */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refrescar sesión de Supabase
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
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Error al refrescar sesión:', error);
        isRefreshing = false;
        refreshPromise = null;
        return false;
      }

      if (data.session) {
        console.log('✅ Sesión refrescada exitosamente');
        isRefreshing = false;
        refreshPromise = null;
        return true;
      }

      isRefreshing = false;
      refreshPromise = null;
      return false;
    } catch (error) {
      console.error('❌ Excepción al refrescar sesión:', error);
      isRefreshing = false;
      refreshPromise = null;
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
 */
export const executeSupabaseQuery = async <T>(
  queryFn: () => Promise<SupabaseResponse<T>>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    autoRefresh?: boolean;
  } = {}
): Promise<SupabaseResponse<T>> => {
  const { maxRetries = 1, retryDelay = 1000, autoRefresh = true } = options;
  
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Asegurar sesión activa antes de ejecutar (proactivo)
      if (autoRefresh) {
        const hasActiveSession = await ensureActiveSession();
        if (!hasActiveSession) {
          console.log('⚠️ No se pudo asegurar sesión activa, intentando refrescar...');
          const refreshed = await refreshSession();
          if (!refreshed) {
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (!newSession) {
              throw new Error('No hay sesión activa y no se pudo refrescar');
            }
          }
        }
      }
      
      // Ejecutar la query
      const result = await queryFn();
      
      // Si hay error de autenticación y auto-refresh está habilitado
      if (result.error && isAuthError(result.error) && autoRefresh && attempt < maxRetries) {
        console.log(`🔄 Error de autenticación detectado (intento ${attempt + 1}/${maxRetries + 1}), refrescando sesión...`);
        
        const refreshed = await refreshSession();
        if (refreshed) {
          // Esperar un poco antes de reintentar
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          lastError = result.error;
          continue; // Reintentar
        } else {
          throw result.error;
        }
      }
      
      // Si hay error pero no es de autenticación, o ya se agotaron los reintentos
      if (result.error) {
        throw result.error;
      }
      
      // Éxito
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Si es error de autenticación y aún hay reintentos disponibles
      if (isAuthError(error) && autoRefresh && attempt < maxRetries) {
        console.log(`🔄 Error de autenticación (intento ${attempt + 1}/${maxRetries + 1}), refrescando sesión...`);
        
        const refreshed = await refreshSession();
        if (refreshed) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Reintentar
        }
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

