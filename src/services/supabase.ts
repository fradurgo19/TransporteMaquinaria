import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Helper para crear AbortController con timeout (compatible con navegadores más antiguos)
const createTimeoutSignal = (timeoutMs: number): AbortSignal => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  // Limpiar timeout si el signal ya fue abortado
  // Esto previene memory leaks
  if (controller.signal.aborted) {
    clearTimeout(timeoutId);
  }
  
  return controller.signal;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'transport-management-app',
    },
    // Timeout para requests HTTP (15 segundos - más agresivo para evitar bloqueos)
    // Mejorado con mejor manejo de abort y reconexión
    fetch: async (url, options = {}) => {
      const timeoutMs = 15000;
      
      // Si ya hay un signal, usarlo; si no, crear uno con timeout
      let signal = options.signal;
      let timeoutController: AbortController | null = null;
      
      if (!signal) {
        timeoutController = new AbortController();
        signal = timeoutController.signal;
        
        // Configurar timeout
        const timeoutId = setTimeout(() => {
          if (timeoutController && !timeoutController.signal.aborted) {
            timeoutController.abort();
          }
        }, timeoutMs);
        
        // Limpiar timeout cuando el signal se aborte
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      }
      
      const fetchStartTime = Date.now();
      
      try {
        const response = await fetch(url, {
          ...options,
          signal,
        });
        
        return response;
      } catch (error: any) {
        // Si es error de timeout/abort, lanzar error más descriptivo
        if (error.name === 'AbortError' || error.name === 'TimeoutError' || signal?.aborted) {
          const error = new Error(`Request timeout después de ${timeoutMs}ms`);
          (error as any).isTimeout = true;
          throw error;
        }
        throw error;
      }
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Constantes para paginación y optimización
export const QUERY_LIMITS = {
  EQUIPMENT: 50,
  OPERATION_HOURS: 20,
  FUEL_LOGS: 30,
  OPERATIONS: 30,
  DASHBOARD_ALERTS: 10,
} as const;

// Campos mínimos para listados (sin campos grandes como notas o imágenes)
export const EQUIPMENT_LIST_FIELDS = `
  id,
  driver_name,
  site_location,
  brand,
  license_plate,
  serial_number,
  vehicle_type,
  technical_inspection_expiration,
  soat_expiration,
  insurance_policy_expiration,
  driver_license_expiration,
  permit_status,
  status,
  technical_inspection_url,
  soat_url,
  insurance_policy_url,
  driver_license_url
`;

export const EQUIPMENT_FULL_FIELDS = `
  id,
  driver_name,
  site_location,
  brand,
  license_plate,
  serial_number,
  vehicle_type,
  technical_inspection_expiration,
  soat_expiration,
  insurance_policy_expiration,
  driver_license_expiration,
  permit_status,
  status,
  notes,
  technical_inspection_url,
  soat_url,
  insurance_policy_url,
  driver_license_url
`;
