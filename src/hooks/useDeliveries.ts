import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { Delivery, DeliveryTracking } from '../types';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { ensureActiveSession } from '../services/sessionManager';

interface DeliveriesQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

/**
 * Hook para obtener entregas de logística
 */
export const useDeliveries = (params: DeliveriesQueryParams = {}) => {
  const { page = 1, limit = 30, status, search } = params;

  return useQuery({
    queryKey: ['deliveries', page, limit, status, search],
    queryFn: async () => {
      // Asegurar sesión activa antes de hacer la query (proactivo)
      const hasActiveSession = await ensureActiveSession();
      if (!hasActiveSession) {
        console.error('❌ No hay sesión activa para cargar entregas');
        throw new Error('No hay sesión activa');
      }

      let query = supabase
        .from('deliveries')
        .select('*', { count: 'exact' })
        .eq('department', 'logistics')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`tracking_number.ilike.%${search}%,customer_name.ilike.%${search}%,delivery_address.ilike.%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const result = await executeSupabaseQuery(() => query);

      if (result.error) {
        console.error('Error fetching deliveries:', result.error);
        throw result.error;
      }

      return {
        data: result.data as Delivery[],
        total: result.count || 0,
        page,
        limit,
        totalPages: Math.ceil((result.count || 0) / limit),
      };
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para obtener tracking de una entrega
 */
export const useDeliveryTracking = (deliveryId: string) => {
  return useQuery({
    queryKey: ['delivery_tracking', deliveryId],
    queryFn: async () => {
      // Asegurar sesión activa antes de hacer la query (proactivo)
      const hasActiveSession = await ensureActiveSession();
      if (!hasActiveSession) {
        console.error('❌ No hay sesión activa para cargar tracking');
        throw new Error('No hay sesión activa');
      }

      const result = await executeSupabaseQuery(() =>
        supabase
          .from('delivery_tracking')
          .select('*')
          .eq('delivery_id', deliveryId)
          .order('created_at', { ascending: false })
      );

      if (result.error) throw result.error;
      return result.data as DeliveryTracking[];
    },
    enabled: !!deliveryId,
    staleTime: 30 * 1000,
  });
};

/**
 * Hook para mutaciones de entregas
 */
export const useDeliveriesMutation = () => {
  const queryClient = useQueryClient();

  const createDelivery = useMutation({
    mutationFn: async (delivery: Partial<Delivery>) => {
      const { data, error } = await supabase
        .from('deliveries')
        .insert([{ ...delivery, department: 'logistics' }])
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });

  const updateDelivery = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Delivery> }) => {
      const { data, error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });

  const addTracking = useMutation({
    mutationFn: async (tracking: Partial<DeliveryTracking>) => {
      const { data, error } = await supabase
        .from('delivery_tracking')
        .insert([tracking])
        .select()
        .single();

      if (error) throw error;
      return data as DeliveryTracking;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery_tracking', data.delivery_id] });
    },
  });

  return {
    createDelivery,
    updateDelivery,
    addTracking,
  };
};

