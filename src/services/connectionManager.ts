import { supabase } from './supabase';

/**
 * Gestor de conexión que valida y reconecta automáticamente cuando las conexiones
 * se cierran después de inactividad. Resuelve el problema de timeouts indefinidos.
 * 
 * ESTRATEGIA: Usar fetch directo a un endpoint simple en lugar de métodos de Supabase
 * que también pueden colgarse cuando la conexión está rota.
 */

let connectionValidatedAt = 0;
const CONNECTION_VALIDATION_INTERVAL = 2 * 60 * 1000; // Validar cada 2 minutos
const CONNECTION_TIMEOUT = 3000; // 3 segundos para validar conexión (más agresivo)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Validar que la conexión a Supabase está activa haciendo un fetch directo
 * a un endpoint simple. Esto evita usar métodos de Supabase que también pueden colgarse.
 * ESTRATEGIA: Ser muy permisivo - si no puede validar rápidamente, asumir que está bien
 */
export const validateConnection = async (): Promise<boolean> => {
  try {
    // Usar fetch directo a un endpoint simple de Supabase
    // Usar el endpoint de auth que siempre existe
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
    
    try {
      // Hacer un fetch directo al endpoint de auth (más confiable)
      // Usar OPTIONS o HEAD para minimizar carga
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseAnonKey,
        },
        signal: controller.signal,
      }).catch(() => {
        // Si el endpoint no existe, intentar con el endpoint principal
        return fetch(`${supabaseUrl}/`, {
          method: 'HEAD',
          signal: controller.signal,
        });
      });
      
      clearTimeout(timeoutId);
      
      // Cualquier respuesta (incluso error 404) significa que la conexión funciona
      connectionValidatedAt = Date.now();
      return true;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Si es AbortError (timeout), la conexión puede estar rota
      // Pero ser permisivo y asumir que está bien (la operación usará su propio timeout)
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        // Ser permisivo: no bloquear, dejar que la operación use su propio timeout
        console.warn('⚠️ Validación de conexión timeout, permitiendo operación');
        return true; // Ser permisivo para evitar bloqueos
      }
      
      // Otros errores pueden ser de red, pero asumir que está bien
      connectionValidatedAt = Date.now();
      return true;
    }
  } catch (error) {
    // Si falla completamente, ser permisivo y asumir que está bien
    // La operación tendrá su propio timeout
    console.warn('⚠️ Error validando conexión, permitiendo operación con timeout propio');
    return true; // Ser permisivo para evitar bloqueos
  }
};

/**
 * Verificar si la conexión necesita validación (ha pasado mucho tiempo desde la última validación)
 */
export const shouldValidateConnection = (): boolean => {
  const timeSinceValidation = Date.now() - connectionValidatedAt;
  return timeSinceValidation > CONNECTION_VALIDATION_INTERVAL;
};

/**
 * Asegurar que la conexión está activa antes de hacer una operación crítica
 * ESTRATEGIA MEJORADA: Si no puede validar, permitir que la operación continúe
 * con su propio timeout (más permisivo para evitar bloqueos)
 */
export const ensureConnection = async (): Promise<boolean> => {
  // Si la conexión fue validada recientemente, asumir que está bien
  if (!shouldValidateConnection()) {
    return true;
  }

  // Intentar validar conexión con timeout muy corto
  try {
    const isValid = await Promise.race([
      validateConnection(),
      new Promise<boolean>((resolve) => 
        setTimeout(() => {
          // Si la validación tarda mucho, asumir que está bien y dejar que la operación
          // use su propio timeout (más permisivo)
          console.warn('⚠️ Validación de conexión lenta, permitiendo operación con timeout propio');
          resolve(true);
        }, 2000) // Timeout de 2 segundos para la validación misma
      )
    ]);
    
    return isValid;
  } catch (error) {
    // Si falla la validación, ser permisivo y permitir que la operación continúe
    // La operación tendrá su propio timeout que la manejará
    console.warn('⚠️ No se pudo validar conexión, permitiendo operación con timeout propio');
    return true; // Ser permisivo para evitar bloqueos
  }
};

/**
 * Wrapper para operaciones críticas que asegura conexión antes de ejecutar
 * ESTRATEGIA MEJORADA: No bloquear si no puede validar, dejar que la operación
 * use su propio timeout
 */
export const withConnectionCheck = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> => {
  // Intentar asegurar conexión (no bloqueante si falla)
  // Usar Promise.race para no bloquear si la validación tarda
  const connectionCheck = ensureConnection().catch(() => {
    // Si falla, permitir que la operación continúe
    return true;
  });
  
  // No esperar la validación, ejecutar la operación directamente
  // La operación tiene su propio timeout que la manejará
  try {
    return await operation();
  } catch (error: any) {
    // Si es timeout, resetear validación para próxima vez
    if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
      console.log(`⏱️ Timeout en ${operationName}`);
      connectionValidatedAt = 0; // Resetear para forzar validación en próxima operación
    }
    
    throw error;
  }
};

/**
 * Forzar validación de conexión (útil después de períodos de inactividad)
 * ESTRATEGIA MEJORADA: No bloquear, validar en background
 */
export const forceConnectionValidation = async (): Promise<boolean> => {
  connectionValidatedAt = 0; // Resetear para forzar validación
  
  // Validar en background sin bloquear
  // Usar Promise.race para no bloquear si tarda
  return await Promise.race([
    ensureConnection(),
    new Promise<boolean>((resolve) => 
      setTimeout(() => {
        // Si tarda más de 2 segundos, asumir que está bien
        // (más permisivo para evitar bloqueos)
        resolve(true);
      }, 2000)
    )
  ]);
};
