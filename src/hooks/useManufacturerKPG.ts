import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

export interface ManufacturerKPG {
  id: string;
  manufacturer: string;
  brand: string;
  model: string;
  vehicle_type: string;
  year: number | null;
  kpg: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ManufacturerKPGForm {
  manufacturer: string;
  brand: string;
  model: string;
  vehicle_type: string;
  year: number | null;
  kpg: number;
  notes?: string;
}

/**
 * Hook para obtener todos los registros de KPG de fábrica
 */
export const useManufacturerKPG = () => {
  return useQuery({
    queryKey: ['manufacturer-kpg'],
    queryFn: async (): Promise<ManufacturerKPG[]> => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('manufacturer_kpg')
          .select('*')
          .order('manufacturer', { ascending: true })
          .order('brand', { ascending: true })
          .order('model', { ascending: true })
      );

      if (result.error) {
        console.error('Error fetching manufacturer KPG:', result.error);
        throw result.error;
      }

      return (Array.isArray(result.data) ? result.data : []) as ManufacturerKPG[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

/**
 * Hook para obtener KPG de fábrica por criterios (búsqueda)
 */
export const useManufacturerKPGSearch = (criteria: {
  brand?: string;
  vehicle_type?: string;
  manufacturer?: string;
}) => {
  return useQuery({
    queryKey: ['manufacturer-kpg', 'search', criteria],
    queryFn: async (): Promise<ManufacturerKPG[]> => {
      let query = supabase.from('manufacturer_kpg').select('*');

      if (criteria.brand) {
        query = query.ilike('brand', `%${criteria.brand}%`);
      }
      if (criteria.vehicle_type) {
        query = query.eq('vehicle_type', criteria.vehicle_type);
      }
      if (criteria.manufacturer) {
        query = query.ilike('manufacturer', `%${criteria.manufacturer}%`);
      }

      const result = await executeSupabaseQuery(async () => await query.order('kpg', { ascending: false }));

      if (result.error) {
        console.error('Error searching manufacturer KPG:', result.error);
        throw result.error;
      }

      return (Array.isArray(result.data) ? result.data : []) as ManufacturerKPG[];
    },
    enabled: !!criteria.brand || !!criteria.vehicle_type || !!criteria.manufacturer,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para mutaciones (crear, actualizar, eliminar) de KPG de fábrica
 */
export const useManufacturerKPGMutation = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: ManufacturerKPGForm): Promise<ManufacturerKPG> => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('manufacturer_kpg')
          .insert([data])
          .select()
          .single()
      );

      if (result.error) {
        console.error('Error creating manufacturer KPG:', result.error);
        throw result.error;
      }

      return result.data as ManufacturerKPG;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer-kpg'] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ManufacturerKPGForm> }): Promise<ManufacturerKPG> => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('manufacturer_kpg')
          .update(data)
          .eq('id', id)
          .select()
          .single()
      );

      if (result.error) {
        console.error('Error updating manufacturer KPG:', result.error);
        throw result.error;
      }

      return result.data as ManufacturerKPG;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer-kpg'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('manufacturer_kpg')
          .delete()
          .eq('id', id)
      );

      if (result.error) {
        console.error('Error deleting manufacturer KPG:', result.error);
        throw result.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer-kpg'] });
    },
  });

  return { create, update, remove };
};

/**
 * Función para obtener KPG de fábrica que coincida con un equipo
 * Busca por brand y vehicle_type, y si hay year también lo considera
 */
export const getManufacturerKPGForEquipment = async (
  brand: string,
  vehicleType: string,
  model?: string,
  year?: number
): Promise<ManufacturerKPG | null> => {
  try {
    let query = supabase
      .from('manufacturer_kpg')
      .select('*')
      .eq('brand', brand)
      .eq('vehicle_type', vehicleType);

    if (model) {
      query = query.eq('model', model);
    }

    // Buscar el que más coincida: primero con año exacto, luego sin año
    const result = await executeSupabaseQuery(async () => await query.order('year', { ascending: false }));

    if (result.error || !result.data) {
      return null;
    }

    const dataArray = Array.isArray(result.data) ? result.data : [];
    if (dataArray.length === 0) {
      return null;
    }

    // Si hay año, buscar coincidencia exacta primero
    if (year) {
      const exactMatch = dataArray.find((kpg: any) => kpg.year === year);
      if (exactMatch) return exactMatch as ManufacturerKPG;
    }

    // Si no hay año o no hay coincidencia exacta, buscar sin año (NULL)
    const noYearMatch = dataArray.find((kpg: any) => kpg.year === null);
    if (noYearMatch) return noYearMatch as ManufacturerKPG;

    // Si no hay coincidencia sin año, devolver el primero (puede ser otro año)
    return dataArray[0] as ManufacturerKPG;
  } catch (error) {
    console.error('Error getting manufacturer KPG for equipment:', error);
    return null;
  }
};

