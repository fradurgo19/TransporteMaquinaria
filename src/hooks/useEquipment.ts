import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, EQUIPMENT_LIST_FIELDS, EQUIPMENT_FULL_FIELDS, QUERY_LIMITS } from '../services/supabase';
import { useDepartment } from './useDepartment';

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
  const { department } = useDepartment();
  
  return useQuery({
    queryKey: ['equipment', department, page, limit, status, search, useFullFields],
    queryFn: async () => {
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

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching equipment:', error);
        throw error;
      }

      return {
        data: data as Equipment[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 2 * 60 * 1000,
    refetchInterval: 30 * 1000, // Polling cada 30 segundos
    refetchIntervalInBackground: false,
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

