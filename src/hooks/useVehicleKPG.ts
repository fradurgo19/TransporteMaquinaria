import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

export interface VehicleKPG {
  vehicle_plate: string;
  brand: string;
  vehicle_type: string;
  real_kpg: number; // KPG real calculado desde fuel_logs
  manufacturer_kpg: number | null; // KPG de fábrica (si existe)
  difference: number | null; // Diferencia porcentual
  total_distance: number; // Total de kms recorridos
  total_gallons: number; // Total de galones
}

/**
 * Hook para obtener KPG real por vehículo (últimos 30 días)
 */
export const useVehicleKPG = () => {
  return useQuery({
    queryKey: ['vehicle-kpg'],
    queryFn: async (): Promise<VehicleKPG[]> => {
      // Obtener fuel_logs de los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fuelResult = await executeSupabaseQuery(async () =>
        await supabase
          .from('fuel_logs')
          .select('vehicle_plate, distance_traveled, gallons, fuel_efficiency')
          .gte('fuel_date', thirtyDaysAgo.toISOString())
      );

      if (fuelResult.error) {
        console.error('Error fetching fuel logs:', fuelResult.error);
        throw fuelResult.error;
      }

      const fuelLogs = fuelResult.data || [];

      // Obtener información de equipos
      const equipmentResult = await executeSupabaseQuery(async () =>
        await supabase
          .from('equipment')
          .select('license_plate, brand, vehicle_type')
          .eq('status', 'active')
      );

      if (equipmentResult.error) {
        console.error('Error fetching equipment:', equipmentResult.error);
        throw equipmentResult.error;
      }

      const equipmentArray = Array.isArray(equipmentResult.data) ? equipmentResult.data : [];

      // Calcular KPG por vehículo
      const vehicleKPGFMap = new Map<string, {
        total_distance: number;
        total_gallons: number;
        brand: string;
        vehicle_type: string;
      }>();

      const fuelLogsArray = Array.isArray(fuelLogs) ? fuelLogs : [];
      fuelLogsArray.forEach((log: any) => {
        const plate = log.vehicle_plate;
        const distance = log.distance_traveled || 0;
        const gallons = log.gallons || 0;

        if (!vehicleKPGFMap.has(plate)) {
          const eq = equipmentArray.find((e: any) => e.license_plate === plate);
          vehicleKPGFMap.set(plate, {
            total_distance: 0,
            total_gallons: 0,
            brand: eq?.brand || 'Unknown',
            vehicle_type: eq?.vehicle_type || 'tractor',
          });
        }

        const vehicle = vehicleKPGFMap.get(plate)!;
        vehicle.total_distance += distance;
        vehicle.total_gallons += gallons;
      });

      // Convertir a array y calcular KPG real
      const vehicleKPGF: VehicleKPG[] = [];

      for (const [plate, data] of vehicleKPGFMap.entries()) {
        const real_kpg = data.total_gallons > 0 ? data.total_distance / data.total_gallons : 0;

        vehicleKPGF.push({
          vehicle_plate: plate,
          brand: data.brand,
          vehicle_type: data.vehicle_type,
          real_kpg,
          manufacturer_kpg: null,
          difference: null,
          total_distance: data.total_distance,
          total_gallons: data.total_gallons,
        });
      }

      // Obtener KPG de fábrica para cada vehículo (opcional - si la tabla no existe, continuar sin estos datos)
      try {
        const manufacturerKPGResult = await executeSupabaseQuery(async () =>
          await supabase
            .from('manufacturer_kpg')
            .select('*')
        );

        if (!manufacturerKPGResult.error && manufacturerKPGResult.data) {
          const manufacturerKPGArray = Array.isArray(manufacturerKPGResult.data) ? manufacturerKPGResult.data : [];
          vehicleKPGF.forEach((vehicle) => {
            // Buscar KPG de fábrica que coincida
            const match = manufacturerKPGArray.find(
              (mkpg: any) =>
                mkpg.brand === vehicle.brand &&
                mkpg.vehicle_type === vehicle.vehicle_type
            );

            if (match) {
              vehicle.manufacturer_kpg = match.kpg;
              // Calcular diferencia porcentual
              if (vehicle.real_kpg > 0 && match.kpg > 0) {
                vehicle.difference = ((vehicle.real_kpg - match.kpg) / match.kpg) * 100;
              }
            }
          });
        }
      } catch (error: any) {
        // Si la tabla no existe (404) o hay otro error, simplemente continuar sin datos de manufacturer_kpg
        // Esto es opcional y no debe fallar toda la query
        if (error?.status === 404 || error?.code === 'PGRST116' || error?.message?.includes('404')) {
          console.warn('⚠️ Tabla manufacturer_kpg no encontrada, continuando sin datos de KPG de fábrica');
        } else {
          console.warn('⚠️ Error al obtener manufacturer_kpg:', error);
        }
        // Continuar sin estos datos - no es crítico
      }

      // Ordenar por KPG real descendente
      return vehicleKPGF.sort((a, b) => b.real_kpg - a.real_kpg);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

