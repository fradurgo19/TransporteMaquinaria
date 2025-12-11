import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { ensureActiveSession } from '../services/sessionManager';

interface FuelLog {
  id: string;
  vehicle_plate: string;
  fuel_date: string;
  gallons: number;
  cost: number;
  starting_odometer: number;
  ending_odometer: number;
  distance_traveled?: number;
  fuel_efficiency?: number;
  receipt_photo_path?: string;
  receipt_photo_url?: string;
  gas_station_name?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  created_by?: string;
  department?: string;
  created_at: string;
  updated_at?: string;
}

interface FuelLogQueryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  vehiclePlate?: string;
}

/**
 * Hook para obtener registros de combustible
 */
export const useFuelLogs = (params: FuelLogQueryParams = {}) => {
  const { page = 1, limit = 50, startDate, endDate, vehiclePlate } = params;

  return useQuery({
    queryKey: ['fuel_logs', page, limit, startDate, endDate, vehiclePlate],
    queryFn: async () => {
      // Timeout para evitar que la query se quede colgada
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: La consulta tardó demasiado')), 30000)
      );

      const queryPromise = (async () => {
        // Asegurar sesión activa antes de hacer la query (proactivo)
        const hasActiveSession = await ensureActiveSession();
        if (!hasActiveSession) {
          console.error('❌ No hay sesión activa para cargar fuel logs');
          throw new Error('No hay sesión activa');
        }

        let query = supabase
          .from('fuel_logs')
          .select('*', { count: 'exact' })
          .order('fuel_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (startDate) {
          query = query.gte('fuel_date', startDate);
        }

        if (endDate) {
          query = query.lte('fuel_date', endDate);
        }

        if (vehiclePlate) {
          query = query.eq('vehicle_plate', vehiclePlate.toUpperCase());
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          console.error('Error fetching fuel logs:', error);
          throw error;
        }

        return {
          data: (data || []) as FuelLog[],
          total: count || 0,
          page,
          limit,
        };
      })();

      return Promise.race([queryPromise, timeoutPromise]) as Promise<{
        data: FuelLog[];
        total: number;
        page: number;
        limit: number;
      }>;
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};

/**
 * Hook para actualizar un registro de combustible
 */
export const useUpdateFuelLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FuelLog> }) => {
      const { data, error } = await supabase
        .from('fuel_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating fuel log:', error);
        throw error;
      }

      return data as FuelLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_logs'] });
    },
  });
};

/**
 * Hook para eliminar un registro de combustible
 */
export const useDeleteFuelLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fuel_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting fuel log:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_logs'] });
    },
  });
};

export type { FuelLog, FuelLogQueryParams };

