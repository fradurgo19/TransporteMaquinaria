import React from 'react';
import { MainLayout } from '../templates/MainLayout';
import { MetricCard } from '../molecules/MetricCard';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Badge } from '../atoms/Badge';
import { Truck, Fuel, Clock, AlertCircle } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';

export const DashboardPage: React.FC = () => {
  useProtectedRoute(['admin']); // Solo administradores

  const mockMetrics = {
    totalKilometers: 12543,
    fuelConsumption: 3421,
    activeVehicles: 18,
    expiringDocuments: 5,
  };

  const mockAlerts = [
    {
      id: '1',
      type: 'warning' as const,
      message: 'Vehicle ABC-123 technical inspection expires in 7 days',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'error' as const,
      message: 'Vehicle XYZ-789 SOAT expired',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      type: 'info' as const,
      message: 'Driver license renewal required for John Doe',
      timestamp: new Date().toISOString(),
    },
  ];

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
            value={mockMetrics.totalKilometers.toLocaleString()}
            icon={Truck}
            iconColor="text-blue-600"
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title="Fuel Consumption (L)"
            value={mockMetrics.fuelConsumption.toLocaleString()}
            icon={Fuel}
            iconColor="text-orange-600"
          />
          <MetricCard
            title="Active Vehicles"
            value={mockMetrics.activeVehicles}
            icon={Clock}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Expiring Documents"
            value={mockMetrics.expiringDocuments}
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
              <div className="space-y-4">
                {mockAlerts.map((alert) => (
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
                        {new Date(alert.timestamp).toLocaleString()}
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Vehicle Status
              </h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {[
                  { plate: 'ABC-123', status: 'Active', location: 'Site A' },
                  { plate: 'XYZ-789', status: 'Maintenance', location: 'Workshop' },
                  { plate: 'DEF-456', status: 'Active', location: 'Site B' },
                ].map((vehicle) => (
                  <div
                    key={vehicle.plate}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{vehicle.plate}</p>
                      <p className="text-sm text-gray-500">{vehicle.location}</p>
                    </div>
                    <Badge
                      variant={vehicle.status === 'Active' ? 'success' : 'warning'}
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};
