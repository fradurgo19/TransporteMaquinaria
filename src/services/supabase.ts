import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

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
