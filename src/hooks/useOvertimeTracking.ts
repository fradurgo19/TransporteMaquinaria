import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

interface OvertimeTracking {
  id: string;
  operation_hour_id: string;
  placa: string;
  conductor: string;
  fecha: string;
  hora_entrada: string;
  hora_salida: string | null;
  hora_entrada_gps: string | null;
  hora_salida_gps: string | null;
  ubicacion_inicio: string | null;
  ubicacion_fin: string | null;
  kilometros_recorridos: number | null;
  ubicacion: string | null;
  actividad: string | null;
  dia_semana: string | null;
  tipo_dia: string | null;
  mes: string | null;
  validacion_entrada: string | null;
  validacion_salida: string | null;
  he_diurna_decimal: number;
  desayuno_almuerzo_decimal: number;
  horario_compensado_decimal: number;
  total_he_diurna_decimal: number;
  he_nocturna_decimal: number;
  dom_fest_decimal: number;
  horas_finales_decimal: number;
  gps_data_uploaded: boolean | null;
  created_at: string;
}

interface OvertimeQueryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  placa?: string;
}

/**
 * Hook para obtener registros de horas extras
 */
export const useOvertimeTracking = (params: OvertimeQueryParams = {}) => {
  const { page = 1, limit = 50, startDate, endDate, placa } = params;

  return useQuery({
    queryKey: ['overtime_tracking', page, limit, startDate, endDate, placa],
    queryFn: async () => {
      // Verificar sesión antes de hacer la query
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      let query = supabase
        .from('overtime_tracking')
        .select('*', { count: 'exact' })
        .eq('department', 'transport')
        .order('fecha', { ascending: false });

      if (startDate) {
        query = query.gte('fecha', startDate);
      }

      if (endDate) {
        query = query.lte('fecha', endDate);
      }

      if (placa) {
        query = query.eq('placa', placa);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // Ejecutar con interceptor (maneja auto-refresh automáticamente)
      const result = await executeSupabaseQuery(() => query);

      if (result.error) {
        console.error('Error fetching overtime tracking:', result.error);
        throw result.error;
      }

      // Extraer datos de la respuesta
      const responseData = result.data as any;
      const data = (responseData?.data || responseData || []) as OvertimeTracking[];
      const count = responseData?.count || 0;

      return {
        data,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

/**
 * Hook para sincronizar operation_hours con overtime_tracking
 */
export const useSyncOvertimeTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Obtener todos los operation_hours completados que no están en overtime_tracking
      const { data: opHours, error } = await supabase
        .from('operation_hours')
        .select('*')
        .eq('department', 'transport')
        .eq('status', 'completed')
        .not('check_out_time', 'is', null);

      if (error) throw error;

      if (!opHours || opHours.length === 0) {
        return { synced: 0 };
      }

      // Verificar cuáles ya existen
      const { data: existing } = await supabase
        .from('overtime_tracking')
        .select('operation_hour_id');

      const existingIds = new Set(existing?.map(e => e.operation_hour_id) || []);

      // Insertar los que no existen
      const toInsert = opHours
        .filter(oh => !existingIds.has(oh.id))
        .map(oh => ({
          operation_hour_id: oh.id,
          placa: oh.vehicle_plate,
          conductor: oh.driver_name,
          fecha: oh.check_in_time.split('T')[0],
          hora_entrada: oh.check_in_time.split('T')[1].substring(0, 8),
          hora_salida: oh.check_out_time ? oh.check_out_time.split('T')[1].substring(0, 8) : null,
          department: 'transport',
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('overtime_tracking')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      return { synced: toInsert.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_tracking'] });
    },
  });
};

/**
 * Hook para actualizar campos manuales (ubicación, actividad)
 */
export const useUpdateOvertimeTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OvertimeTracking> }) => {
      const { data, error } = await supabase
        .from('overtime_tracking')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_tracking'] });
    },
  });
};

/**
 * Hook para importar datos de GPS desde Excel
 */
export const useImportGPSData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      overtimeId, 
      gpsData 
    }: { 
      overtimeId: string; 
      gpsData: {
        hora_entrada_gps: string;
        hora_salida_gps: string;
        ubicacion_inicio: string;
        ubicacion_fin: string;
        kilometros_recorridos: number;
      }
    }) => {
      const { data, error } = await supabase
        .from('overtime_tracking')
        .update(gpsData)
        .eq('id', overtimeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_tracking'] });
    },
  });
};

export type { OvertimeTracking };

