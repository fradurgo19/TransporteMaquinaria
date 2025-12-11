import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { LogisticsDashboardMetrics } from '../types';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { ensureActiveSession } from '../services/sessionManager';

/**
 * Hook para métricas del dashboard de logística
 */
export const useLogisticsDashboard = () => {
  return useQuery({
    queryKey: ['logistics_dashboard', 'metrics'],
    queryFn: async (): Promise<LogisticsDashboardMetrics> => {
      // Asegurar sesión activa antes de hacer las queries (proactivo)
      const hasActiveSession = await ensureActiveSession();
      if (!hasActiveSession) {
        console.error('❌ No hay sesión activa para cargar métricas de logística');
        throw new Error('No hay sesión activa');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Ejecutar consultas en paralelo con interceptor
      const [totalResult, pendingResult, deliveredTodayResult, vehiclesResult] = await Promise.all([
        // Total de entregas
        executeSupabaseQuery(async () =>
          await supabase
            .from('deliveries')
            .select('id', { count: 'exact', head: true })
            .eq('department', 'logistics')
        ),

        // Entregas pendientes
        executeSupabaseQuery(async () =>
          await supabase
            .from('deliveries')
            .select('id', { count: 'exact', head: true })
            .eq('department', 'logistics')
            .in('status', ['pending', 'assigned', 'in_transit'])
        ),

        // Entregadas hoy
        executeSupabaseQuery(async () =>
          await supabase
            .from('deliveries')
            .select('id', { count: 'exact', head: true })
            .eq('department', 'logistics')
            .eq('status', 'delivered')
            .gte('delivery_date', todayISO)
        ),

        // Vehículos activos de logística
        executeSupabaseQuery(async () =>
          await supabase
            .from('equipment')
            .select('id', { count: 'exact', head: true })
            .eq('department', 'logistics')
            .eq('status', 'active')
        ),
      ]);

      const totalDeliveries = totalResult.count || 0;
      const pendingDeliveries = pendingResult.count || 0;
      const deliveredToday = deliveredTodayResult.count || 0;
      const activeVehicles = vehiclesResult.count || 0;

      // Calcular tiempo promedio de entrega (últimas 30 entregas completadas)
      const completedResult = await executeSupabaseQuery(async () =>
        await supabase
          .from('deliveries')
          .select('pickup_date, delivery_date')
          .eq('department', 'logistics')
          .eq('status', 'delivered')
          .not('pickup_date', 'is', null)
          .not('delivery_date', 'is', null)
          .order('delivery_date', { ascending: false })
          .limit(30)
      );
      const completedDeliveries = Array.isArray(completedResult.data) ? completedResult.data : [];

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
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
      // Asegurar sesión activa antes de hacer la query (proactivo)
      const hasActiveSession = await ensureActiveSession();
      if (!hasActiveSession) {
        console.error('❌ No hay sesión activa para cargar entregas recientes');
        throw new Error('No hay sesión activa');
      }

      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('deliveries')
          .select('id, tracking_number, customer_name, status, created_at')
          .eq('department', 'logistics')
          .order('created_at', { ascending: false })
          .limit(5)
      );

      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 1 * 60 * 1000,
  });
};

