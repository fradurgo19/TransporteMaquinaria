import React from 'react';
import { MainLayout } from '../templates/MainLayout';
import { MetricCard } from '../molecules/MetricCard';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Badge } from '../atoms/Badge';
import { Truck, Fuel, Clock, AlertCircle, Loader, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useDashboardMetrics, useDashboardAlerts } from '../hooks/useDashboard';
import { useEquipment } from '../hooks/useEquipment';
import { useVehicleKPG } from '../hooks/useVehicleKPG';
import { format } from 'date-fns';

export const DashboardPage: React.FC = () => {
  useProtectedRoute(['admin']); // Solo administradores

  // Usar hooks optimizados para cargar datos
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: alerts = [], isLoading: alertsLoading } = useDashboardAlerts();
  const { data: equipmentData } = useEquipment({ limit: 5 }); // Solo primeros 5 para el preview
  const { data: vehicleKPGData = [], isLoading: vehicleKPGFLoading } = useVehicleKPG();

  // Usar datos reales o valores por defecto mientras cargan
  const dashboardMetrics = metrics || {
    totalKilometers: 0,
    fuelConsumption: 0,
    activeVehicles: 0,
    expiringDocuments: 0,
    kmsRecorridos: 0,
    kmPerGallon: 0,
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 hidden sm:block">
            Overview of your transport operations
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <MetricCard
            title="Total Kilometers"
            value={metricsLoading ? '...' : dashboardMetrics.totalKilometers.toLocaleString()}
            icon={Truck}
            iconColor="text-blue-600"
            trend={!metricsLoading ? { value: 12, isPositive: true } : undefined}
          />
          <MetricCard
            title="Fuel Consumption (L)"
            value={metricsLoading ? '...' : dashboardMetrics.fuelConsumption.toLocaleString()}
            icon={Fuel}
            iconColor="text-orange-600"
          />
          <MetricCard
            title="Active Vehicles"
            value={metricsLoading ? '...' : dashboardMetrics.activeVehicles.toString()}
            icon={Clock}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Expiring Documents"
            value={metricsLoading ? '...' : dashboardMetrics.expiringDocuments.toString()}
            icon={AlertCircle}
            iconColor="text-red-600"
          />
        </div>

        {/* Indicadores de Combustible */}
        <Card>
          <CardHeader className="bg-gradient-to-r text-white p-3 sm:p-4" style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }}>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">📊 Campos Calculados (Indicadores)</h2>
          </CardHeader>
          <CardBody className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #50504f' }}>
                <label className="text-xs sm:text-sm font-medium block mb-2" style={{ color: '#50504f' }}>Kms Recorridos</label>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: '#cf1b22' }}>
                  {metricsLoading ? '...' : `${dashboardMetrics.kmsRecorridos.toFixed(2)} km`}
                </p>
              </div>
              <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #50504f' }}>
                <label className="text-xs sm:text-sm font-medium block mb-2" style={{ color: '#50504f' }}>Km/Galon (Indicador Principal)</label>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: '#cf1b22' }}>
                  {metricsLoading ? '...' : `${dashboardMetrics.kmPerGallon.toFixed(2)} km/gal`}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Recent Alerts
              </h2>
            </CardHeader>
            <CardBody>
              {alertsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 text-gray-400 animate-spin" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay alertas pendientes</p>
                </div>
              ) : (
              <div className="space-y-4">
                  {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50"
                  >
                    <AlertCircle
                      className={`h-5 w-5 mt-0.5 ${
                        alert.type === 'error'
                          ? 'text-red-500'
                          : alert.type === 'warning'
                          ? 'text-yellow-500'
                          : 'text-blue-500'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(alert.timestamp), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <Badge
                      variant={
                        alert.type === 'error'
                          ? 'error'
                          : alert.type === 'warning'
                          ? 'warning'
                          : 'info'
                      }
                      size="sm"
                    >
                      {alert.type}
                    </Badge>
                  </div>
                ))}
              </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Vehicle Status
              </h2>
            </CardHeader>
            <CardBody>
              {!equipmentData?.data || equipmentData.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay vehículos registrados</p>
                </div>
              ) : (
              <div className="space-y-4">
                  {equipmentData.data.slice(0, 5).map((vehicle) => (
                  <div
                      key={vehicle.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                        <p className="font-medium text-gray-900">{vehicle.license_plate}</p>
                        <p className="text-sm text-gray-500">{vehicle.site_location}</p>
                    </div>
                    <Badge
                        variant={vehicle.status === 'active' ? 'success' : 'warning'}
                    >
                        {vehicle.status === 'active' ? 'Activo' : vehicle.status}
                    </Badge>
                  </div>
                ))}
              </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Comparación KPG por Vehículo */}
        <Card>
          <CardHeader className="bg-gradient-to-r text-white p-3 sm:p-4" style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }}>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">📊 Comparación KPG: Real vs Fábrica</h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {vehicleKPGFLoading ? (
              <div className="text-center py-8">
                <Loader className="h-6 w-6 text-gray-400 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Cargando comparación de KPG...</p>
              </div>
            ) : vehicleKPGData.length === 0 ? (
              <div className="text-center py-12">
                <Fuel className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No hay datos de KPG disponibles</p>
                <p className="text-sm text-gray-400">Los datos aparecerán después de registrar consumos de combustible</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-[10px] sm:text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Vehículo</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Marca</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Tipo</th>
                      <th className="px-2 sm:px-4 py-3 text-right font-medium text-gray-500 uppercase whitespace-nowrap">KPG Real</th>
                      <th className="px-2 sm:px-4 py-3 text-right font-medium text-gray-500 uppercase whitespace-nowrap">KPG Fábrica</th>
                      <th className="px-2 sm:px-4 py-3 text-right font-medium text-gray-500 uppercase whitespace-nowrap">Diferencia</th>
                      <th className="px-2 sm:px-4 py-3 text-right font-medium text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vehicleKPGData.map((vehicle) => {
                      const hasManufacturerKPG = vehicle.manufacturer_kpg !== null;
                      const isBetter = vehicle.difference !== null && vehicle.difference > 0;
                      const isWorse = vehicle.difference !== null && vehicle.difference < -5; // -5% o peor
                      
                      return (
                        <tr key={vehicle.vehicle_plate} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 text-sm font-semibold text-gray-900">{vehicle.vehicle_plate}</td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-gray-700">{vehicle.brand}</td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-gray-700 capitalize">{vehicle.vehicle_type}</td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-right font-mono font-bold text-blue-900">
                            {vehicle.real_kpg.toFixed(2)} km/gal
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-right font-mono text-gray-700">
                            {hasManufacturerKPG ? (
                              <span>{vehicle.manufacturer_kpg!.toFixed(2)} km/gal</span>
                            ) : (
                              <span className="text-gray-400 italic">No disponible</span>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-right font-mono">
                            {hasManufacturerKPG && vehicle.difference !== null ? (
                              <div className={`flex items-center justify-end gap-1 ${
                                isBetter ? 'text-green-600' : isWorse ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {isBetter ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : isWorse ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : (
                                  <Minus className="h-4 w-4" />
                                )}
                                <span className="font-bold">
                                  {vehicle.difference > 0 ? '+' : ''}{vehicle.difference.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-center hidden sm:table-cell">
                            {hasManufacturerKPG && vehicle.difference !== null ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isBetter 
                                  ? 'bg-green-100 text-green-800' 
                                  : isWorse 
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isBetter ? 'Mejor' : isWorse ? 'Inferior' : 'Aceptable'}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Sin comparación
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
