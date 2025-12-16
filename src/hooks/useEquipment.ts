import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, EQUIPMENT_LIST_FIELDS, EQUIPMENT_FULL_FIELDS, QUERY_LIMITS } from '../services/supabase';
import { useDepartment } from './useDepartment';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { ensureActiveSession } from '../services/sessionManager';

interface Equipment {
  id: string;
  driver_name: string;
  site_location: string;
  brand: string;
  license_plate: string;
  serial_number: string;
  vehicle_type?: string;
  technical_inspection_expiration: string;
  soat_expiration: string;
  insurance_policy_expiration: string;
  driver_license_expiration: string;
  permit_status: string;
  status: string;
  notes?: string;
}

interface EquipmentQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  useFullFields?: boolean;
}

/**
 * Hook optimizado para obtener equipos con paginación
 */
export const useEquipment = (params: EquipmentQueryParams = {}) => {
  const { page = 1, limit = QUERY_LIMITS.EQUIPMENT, status, search, useFullFields = false } = params;
  const fields = useFullFields ? EQUIPMENT_FULL_FIELDS : EQUIPMENT_LIST_FIELDS;
  const { department, isLoading: departmentLoading } = useDepartment();
  
  return useQuery({
    queryKey: ['equipment', department, page, limit, status, search, useFullFields],
    queryFn: async () => {
      if (!department) {
        console.error('❌ Departamento no disponible para cargar equipos');
        throw new Error('Departamento no disponible');
      }

      console.log(`📋 Cargando equipos - Departamento: ${department}, Página: ${page}`);

      // Construir query
      let query = supabase
        .from('equipment')
        .select(fields, { count: 'exact' })
        .eq('department', department) // Filtrar por departamento
        .order('license_plate', { ascending: true });

      // Aplicar filtros
      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`license_plate.ilike.%${search}%,driver_name.ilike.%${search}%,brand.ilike.%${search}%`);
      }

      // Paginación
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // Ejecutar con interceptor (maneja auto-refresh, timeouts y reconexión automáticamente)
      // El interceptor ya maneja timeouts de 15s, no necesitamos timeout adicional
      const result = await executeSupabaseQuery(
        async () => await query,
        {
          timeout: 15000, // 15 segundos (mismo que el interceptor por defecto)
          maxRetries: 2,
          autoRefresh: true,
        }
      );

      if (result.error) {
        console.error('Error fetching equipment:', result.error);
        throw result.error;
      }

      // Supabase devuelve { data: T[], count: number, error: any }
      // El interceptor devuelve { data: { data: T[], count: number }, error: any }
      const responseData = result.data as any;
      const equipmentList = (responseData?.data || responseData || []) as Equipment[];
      const totalCount = responseData?.count || 0;

      return {
        data: equipmentList,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    },
    enabled: !departmentLoading && !!department, // Solo ejecutar si department está listo
    staleTime: 30 * 1000, // 30 segundos (datos más frescos)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false, // Desactivado - QueryProvider maneja esto mejor
    refetchOnMount: true, // Refrescar al montar si está stale
    refetchOnReconnect: true, // Refrescar cuando se reconecta la red
    refetchInterval: false, // No hacer polling automático
    retry: (failureCount, error: any) => {
      // No reintentar si es error de autenticación o timeout (el interceptor ya lo maneja)
      if (
        error?.code === 'PGRST301' || 
        error?.message?.includes('JWT') || 
        error?.message?.includes('token') ||
        error?.message?.includes('Timeout') ||
        error?.message?.includes('No hay sesión activa')
      ) {
        return false;
      }
      // Reintentar hasta 1 vez para otros errores (el interceptor ya hace 2 reintentos)
      return failureCount < 1;
    },
  });
};

/**
 * Hook para obtener un solo equipo por ID
 */
export const useEquipmentById = (id: string | null) => {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('equipment')
        .select(EQUIPMENT_FULL_FIELDS)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching equipment by id:', error);
        throw error;
      }

      return data as Equipment;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para crear/actualizar/eliminar equipos
 */
export const useEquipmentMutation = () => {
  const queryClient = useQueryClient();

  const createEquipment = useMutation({
    mutationFn: async (equipment: Partial<Equipment>) => {
      const { data, error } = await supabase
        .from('equipment')
        .insert([equipment])
        .select()
        .single();

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      // Invalidar queries de equipos para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const updateEquipment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Equipment> }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: (data) => {
      // Actualizar cache específico y lista
      queryClient.setQueryData(['equipment', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  return {
    createEquipment,
    updateEquipment,
    deleteEquipment,
  };
};

