import React from 'react';
import { MainLayout } from '../templates/MainLayout';
import { MetricCard } from '../molecules/MetricCard';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Badge } from '../atoms/Badge';
import { Truck, Fuel, Clock, AlertCircle, Loader } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useDashboardMetrics, useDashboardAlerts } from '../hooks/useDashboard';
import { useEquipment } from '../hooks/useEquipment';
import { format } from 'date-fns';

export const DashboardPage: React.FC = () => {
  useProtectedRoute(['admin']); // Solo administradores

  // Usar hooks optimizados para cargar datos
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: alerts = [], isLoading: alertsLoading } = useDashboardAlerts();
  const { data: equipmentData } = useEquipment({ limit: 5 }); // Solo primeros 5 para el preview

  // Usar datos reales o valores por defecto mientras cargan
  const dashboardMetrics = metrics || {
    totalKilometers: 0,
    fuelConsumption: 0,
    activeVehicles: 0,
    expiringDocuments: 0,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Overview of your transport operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>
    </MainLayout>
  );
};
