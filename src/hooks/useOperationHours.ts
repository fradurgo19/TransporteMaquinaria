import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, QUERY_LIMITS } from '../services/supabase';

interface OperationHour {
  id: string;
  vehicle_plate: string;
  driver_name: string;
  check_in_time: string;
  check_out_time: string | null;
  task_description: string;
  activity_type: string;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  status: string;
  created_at: string;
}

interface OperationHoursQueryParams {
  vehiclePlate?: string;
  page?: number;
  limit?: number;
  status?: string;
}

/**
 * Hook optimizado para obtener horas de operación
 */
export const useOperationHours = (params: OperationHoursQueryParams = {}) => {
  const { vehiclePlate, page = 1, limit = QUERY_LIMITS.OPERATION_HOURS, status } = params;

  return useQuery({
    queryKey: ['operation_hours', vehiclePlate, page, limit, status],
    queryFn: async () => {
      let query = supabase
        .from('operation_hours')
        .select('*', { count: 'exact' })
        .order('check_in_time', { ascending: false });

      // Filtrar por placa si se proporciona
      if (vehiclePlate) {
        query = query.eq('vehicle_plate', vehiclePlate);
      }

      // Filtrar por estado si se proporciona
      if (status) {
        query = query.eq('status', status);
      }

      // Paginación
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching operation hours:', error);
        throw error;
      }

      return {
        data: data as OperationHour[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    },
    enabled: true, // Siempre ejecutar (admins ven todo)
    staleTime: 0, // Siempre considerar stale - refrescar cada vez
    gcTime: 2 * 60 * 1000,
    refetchOnMount: true, // Siempre refrescar al montar
  });
};

/**
 * Hook para obtener el registro activo (in_progress) de un vehículo
 */
export const useActiveOperationHour = (vehiclePlate?: string) => {
  return useQuery({
    queryKey: ['operation_hours', 'active', vehiclePlate],
    queryFn: async () => {
      if (!vehiclePlate) return null;

      const { data, error } = await supabase
        .from('operation_hours')
        .select('*')
        .eq('vehicle_plate', vehiclePlate)
        .eq('status', 'in_progress')
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 es "not found", lo cual es válido
        console.error('Error fetching active operation hour:', error);
        throw error;
      }

      return data as OperationHour | null;
    },
    enabled: !!vehiclePlate,
    staleTime: 0, // Siempre fresh
    refetchInterval: 30 * 1000, // Refrescar cada 30 segundos
    refetchOnMount: true,
  });
};

/**
 * Hook para mutaciones de horas de operación
 */
export const useOperationHoursMutation = () => {
  const queryClient = useQueryClient();

  const startWork = useMutation({
    mutationFn: async (data: Partial<OperationHour>) => {
      const { data: result, error } = await supabase
        .from('operation_hours')
        .insert([{
          ...data,
          status: 'in_progress',
          check_out_time: null,
        }])
        .select()
        .single();

      if (error) throw error;
      return result as OperationHour;
    },
    onSuccess: (data) => {
      // Invalidar todas las queries de operation_hours para este vehículo
      queryClient.invalidateQueries({ 
        queryKey: ['operation_hours'],
        refetchType: 'active',
      });
      console.log('✅ Cache invalidado - datos actualizados');
    },
  });

  const finishWork = useMutation({
    mutationFn: async ({ id, checkOutTime }: { id: string; checkOutTime: string }) => {
      const { data, error } = await supabase
        .from('operation_hours')
        .update({
          check_out_time: checkOutTime,
          status: 'completed',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OperationHour;
    },
    onSuccess: (data) => {
      // Invalidar todas las queries de operation_hours
      queryClient.invalidateQueries({ 
        queryKey: ['operation_hours'],
        refetchType: 'active',
      });
      console.log('✅ Cache invalidado - datos actualizados');
    },
  });

  return {
    startWork,
    finishWork,
  };
};

