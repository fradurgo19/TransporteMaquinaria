import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { LogisticsDashboardMetrics } from '../types';

/**
 * Hook para métricas del dashboard de logística
 */
export const useLogisticsDashboard = () => {
  return useQuery({
    queryKey: ['logistics_dashboard', 'metrics'],
    queryFn: async (): Promise<LogisticsDashboardMetrics> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Ejecutar consultas en paralelo
      const [totalResult, pendingResult, deliveredTodayResult, vehiclesResult] = await Promise.all([
        // Total de entregas
        supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'logistics'),

        // Entregas pendientes
        supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'logistics')
          .in('status', ['pending', 'assigned', 'in_transit']),

        // Entregadas hoy
        supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'logistics')
          .eq('status', 'delivered')
          .gte('delivery_date', todayISO),

        // Vehículos activos de logística
        supabase
          .from('equipment')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'logistics')
          .eq('status', 'active'),
      ]);

      const totalDeliveries = totalResult.count || 0;
      const pendingDeliveries = pendingResult.count || 0;
      const deliveredToday = deliveredTodayResult.count || 0;
      const activeVehicles = vehiclesResult.count || 0;

      // Calcular tiempo promedio de entrega (últimas 30 entregas completadas)
      const { data: completedDeliveries } = await supabase
        .from('deliveries')
        .select('pickup_date, delivery_date')
        .eq('department', 'logistics')
        .eq('status', 'delivered')
        .not('pickup_date', 'is', null)
        .not('delivery_date', 'is', null)
        .order('delivery_date', { ascending: false })
        .limit(30);

      let averageDeliveryTime = 0;
      if (completedDeliveries && completedDeliveries.length > 0) {
        const times = completedDeliveries.map((d: any) => {
          const pickup = new Date(d.pickup_date).getTime();
          const delivery = new Date(d.delivery_date).getTime();
          return (delivery - pickup) / (1000 * 60 * 60); // horas
        });
        averageDeliveryTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }

      return {
        totalDeliveries,
        pendingDeliveries,
        deliveredToday,
        activeVehicles,
        averageDeliveryTime,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para entregas recientes del dashboard de logística
 */
export const useRecentDeliveries = () => {
  return useQuery({
    queryKey: ['logistics_dashboard', 'recent_deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, tracking_number, customer_name, status, created_at')
        .eq('department', 'logistics')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    staleTime: 1 * 60 * 1000,
  });
};

