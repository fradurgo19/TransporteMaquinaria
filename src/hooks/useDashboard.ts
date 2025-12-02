import { useQuery } from '@tanstack/react-query';
import { supabase, QUERY_LIMITS } from '../services/supabase';

interface DashboardMetrics {
  totalKilometers: number;
  fuelConsumption: number;
  activeVehicles: number;
  expiringDocuments: number;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  equipmentId?: string;
}

/**
 * Hook optimizado para obtener métricas del dashboard
 * Usa consultas paralelas para mejor rendimiento
 */
export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async (): Promise<DashboardMetrics> => {
      // Ejecutar consultas en paralelo
      const [equipmentResult, fuelResult, alertsResult] = await Promise.all([
        // Equipos activos
        supabase
          .from('equipment')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        
        // Consumo total de combustible (últimos 30 días)
        supabase
          .from('fuel_logs')
          .select('gallons, cost')
          .gte('fuel_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        
        // Documentos próximos a vencer (simplificado - obtener todos y filtrar en memoria)
        supabase
          .from('equipment')
          .select('id, technical_inspection_expiration, soat_expiration, insurance_policy_expiration, driver_license_expiration'),
      ]);

      const activeVehicles = equipmentResult.count || 0;
      const fuelConsumption = fuelResult.data?.reduce((sum, log: any) => sum + (log.gallons || 0), 0) || 0;
      
      // Contar documentos próximos a vencer (próximos 30 días)
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      let expiringDocuments = 0;
      if (alertsResult.data) {
        alertsResult.data.forEach((eq: any) => {
          const fields = [
            eq.technical_inspection_expiration,
            eq.soat_expiration,
            eq.insurance_policy_expiration,
            eq.driver_license_expiration,
          ];
          fields.forEach((date) => {
            if (date) {
              const expDate = new Date(date);
              if (expDate <= thirtyDaysFromNow && expDate >= new Date()) {
                expiringDocuments++;
              }
            }
          });
        });
      }

      // TODO: Calcular kilómetros totales desde operation_hours o fuel_logs
      const totalKilometers = 0;

      return {
        totalKilometers,
        fuelConsumption: Math.round(fuelConsumption * 10) / 10,
        activeVehicles,
        expiringDocuments,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para obtener alertas del dashboard (solo las más recientes)
 */
export const useDashboardAlerts = () => {
  return useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: async (): Promise<Alert[]> => {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Obtener equipos con documentos próximos a vencer
      const { data: equipment, error } = await supabase
        .from('equipment')
        .select('id, license_plate, technical_inspection_expiration, soat_expiration, insurance_policy_expiration, driver_license_expiration')
        .order('license_plate', { ascending: true })
        .limit(QUERY_LIMITS.DASHBOARD_ALERTS * 2); // Obtener más para filtrar

      if (error) {
        console.error('Error fetching alerts:', error);
        throw error;
      }

      if (!equipment) return [];

      const alerts: Alert[] = [];

      equipment.forEach((eq) => {
        const fields = [
          { date: eq.technical_inspection_expiration, name: 'Revisión Técnica' },
          { date: eq.soat_expiration, name: 'SOAT' },
          { date: eq.insurance_policy_expiration, name: 'Póliza de Seguro' },
          { date: eq.driver_license_expiration, name: 'Licencia de Conducción' },
        ];

        fields.forEach((field) => {
          if (!field.date) return;

          const expirationDate = new Date(field.date);
          const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

          if (daysUntilExpiration < 0) {
            // Ya vencido
            alerts.push({
              id: `${eq.id}-${field.name}-expired`,
              type: 'error',
              message: `Vehicle ${eq.license_plate} ${field.name} expired`,
              timestamp: expirationDate.toISOString(),
              equipmentId: eq.id,
            });
          } else if (daysUntilExpiration <= 7) {
            // Vence en menos de 7 días
            alerts.push({
              id: `${eq.id}-${field.name}-warning`,
              type: 'warning',
              message: `Vehicle ${eq.license_plate} ${field.name} expires in ${daysUntilExpiration} days`,
              timestamp: expirationDate.toISOString(),
              equipmentId: eq.id,
            });
          }
        });
      });

      // Ordenar por fecha y tomar solo los más recientes
      return alerts
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, QUERY_LIMITS.DASHBOARD_ALERTS);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

