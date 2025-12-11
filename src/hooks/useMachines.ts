import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { ensureActiveSession } from '../services/sessionManager';

export interface Machine {
  id: string;
  serie: string;
  descripcion: string;
  marca: string;
  modelo: string;
  ancho: number | null;
  alto: number | null;
  largo: number | null;
  peso: number | null;
  // Nuevos campos adicionales del RUNT
  numero_identificacion?: string | null;
  numero_serie_gps?: string | null;
  numero_imei_gps?: string | null;
  clase?: string | null;
  cilindraje?: number | null;
  numero_motor?: string | null;
  numero_chasis?: string | null;
  subpartida_arancelaria?: string | null;
  rodaje?: string | null;
  estado_vehiculo?: string | null;
  empresa_gps?: string | null;
  runt_image_url?: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * Hook para obtener la lista de máquinas con React Query
 * Incluye refetch automático y manejo de cache
 */
export const useMachines = () => {
  return useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      // Asegurar sesión activa antes de hacer la query (proactivo)
      const hasActiveSession = await ensureActiveSession();
      if (!hasActiveSession) {
        console.error('❌ No hay sesión activa para cargar máquinas');
        throw new Error('No hay sesión activa');
      }

      console.log('📋 Cargando máquinas desde Supabase...');
      
      const result = await executeSupabaseQuery(() =>
        supabase
          .from('machines')
          .select('*')
          .order('serie', { ascending: true })
      );

      if (result.error) {
        console.error('❌ Error cargando máquinas:', result.error);
        throw result.error;
      }

      const machines = (result.data || []) as Machine[];
      console.log(`✅ Máquinas cargadas: ${machines.length} registros`);
      
      return machines;
    },
    staleTime: 1 * 60 * 1000, // Considerar datos stale después de 1 minuto
    gcTime: 5 * 60 * 1000, // Mantener en cache por 5 minutos
    refetchOnMount: true, // Refrescar al montar si los datos están stale
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco (importante para datos que cambian)
    refetchOnReconnect: true, // Refrescar cuando se reconecta la red
    refetchInterval: false, // No hacer polling automático (solo cuando se necesita)
    retry: (failureCount, error: any) => {
      // Reintentar hasta 2 veces
      return failureCount < 2;
    },
  });
};

/**
 * Hook para invalidar el cache de máquinas
 * Útil después de crear, actualizar o eliminar una máquina
 */
export const useInvalidateMachines = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['machines'] });
  };
};

