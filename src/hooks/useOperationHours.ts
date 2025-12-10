import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, QUERY_LIMITS } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

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
      console.log(`📋 Cargando operation hours - Placa: ${vehiclePlate || 'TODAS'}, Página: ${page}`);
      
      // Construir query
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

      // Usar interceptor para manejar auto-refresh de sesión
      const result = await executeSupabaseQuery(() => query);

      if (result.error) {
        console.error('❌ Error fetching operation hours:', result.error);
        throw result.error;
      }

      // Extraer datos de la respuesta
      const responseData = result.data as any;
      const data = (responseData?.data || responseData || []) as OperationHour[];
      const count = responseData?.count || 0;

      console.log(`✅ Operation hours cargadas: ${data.length} registros (Total: ${count})`);

      return {
        data,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };
    },
    enabled: true, // Siempre ejecutar (admins ven todo, usuarios solo su vehículo)
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Ya está desactivado globalmente
    retry: (failureCount, error: any) => {
      // Reintentar hasta 2 veces
      return failureCount < 2;
    },
    // Remover polling automático - solo refrescar cuando sea necesario
    // refetchInterval: 10 * 1000, // Comentado para evitar carga constante
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

      // Usar interceptor para manejar auto-refresh de sesión
      const result = await executeSupabaseQuery(() =>
        supabase
          .from('operation_hours')
          .select('*')
          .eq('vehicle_plate', vehiclePlate)
          .eq('status', 'in_progress')
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle()
      );

      if (result.error) {
        // PGRST116 es "not found", lo cual es válido
        if (result.error.code === 'PGRST116') {
          return null;
        }
        console.error('❌ Error fetching active operation hour:', result.error);
        throw result.error;
      }

      const responseData = result.data as any;
      return (responseData?.data || responseData || null) as OperationHour | null;
    },
    enabled: !!vehiclePlate,
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 10 * 1000, // Polling cada 10 segundos para registro activo
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    retry: (failureCount, error: any) => {
      // No reintentar si es "not found"
      if (error?.code === 'PGRST116') return false;
      return failureCount < 2;
    },
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

