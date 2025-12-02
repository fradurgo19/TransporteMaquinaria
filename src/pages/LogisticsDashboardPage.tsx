import React from 'react';
import { MainLayout } from '../templates/MainLayout';
import { MetricCard } from '../molecules/MetricCard';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Badge } from '../atoms/Badge';
import { Package, Clock, CheckCircle, Truck, Loader } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useLogisticsDashboard, useRecentDeliveries } from '../hooks/useLogisticsDashboard';
import { format, parseISO } from 'date-fns';
import { DeliveryStatus } from '../types';
import { useNavigate } from 'react-router-dom';

export const LogisticsDashboardPage: React.FC = () => {
  useProtectedRoute(['admin_logistics']);
  const navigate = useNavigate();

  const { data: metrics, isLoading: metricsLoading } = useLogisticsDashboard();
  const { data: recentDeliveries = [], isLoading: deliveriesLoading } = useRecentDeliveries();

  const dashboardMetrics = metrics || {
    totalDeliveries: 0,
    pendingDeliveries: 0,
    deliveredToday: 0,
    activeVehicles: 0,
    averageDeliveryTime: 0,
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    const variants: Record<DeliveryStatus, 'info' | 'warning' | 'success' | 'error'> = {
      pending: 'info',
      assigned: 'warning',
      in_transit: 'warning',
      delivered: 'success',
      cancelled: 'error',
    };

    const labels: Record<DeliveryStatus, string> = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      in_transit: 'En Tránsito',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Logística</h1>
          <p className="mt-2 text-gray-600">
            Resumen de operaciones de logística y entregas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Entregas"
            value={metricsLoading ? '...' : dashboardMetrics.totalDeliveries.toString()}
            icon={Package}
            iconColor="text-blue-600"
          />
          <MetricCard
            title="Entregas Pendientes"
            value={metricsLoading ? '...' : dashboardMetrics.pendingDeliveries.toString()}
            icon={Clock}
            iconColor="text-orange-600"
          />
          <MetricCard
            title="Entregadas Hoy"
            value={metricsLoading ? '...' : dashboardMetrics.deliveredToday.toString()}
            icon={CheckCircle}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Vehículos Activos"
            value={metricsLoading ? '...' : dashboardMetrics.activeVehicles.toString()}
            icon={Truck}
            iconColor="text-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entregas Recientes */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Entregas Recientes
              </h2>
            </CardHeader>
            <CardBody>
              {deliveriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 text-gray-400 animate-spin" />
                </div>
              ) : recentDeliveries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No hay entregas registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentDeliveries.map((delivery: any) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tracking/${delivery.id}`)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{delivery.customer_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{delivery.tracking_number}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(parseISO(delivery.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      {getStatusBadge(delivery.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Estadísticas */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Estadísticas
              </h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Tiempo Promedio de Entrega</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {metricsLoading ? '...' : `${dashboardMetrics.averageDeliveryTime}h`}
                      </p>
                    </div>
                    <Clock className="h-10 w-10 text-blue-600" />
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Tasa de Completitud</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">
                        {metricsLoading 
                          ? '...' 
                          : dashboardMetrics.totalDeliveries > 0
                            ? `${Math.round((dashboardMetrics.deliveredToday / dashboardMetrics.totalDeliveries) * 100)}%`
                            : '0%'
                        }
                      </p>
                    </div>
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-700 font-medium">En Proceso</p>
                      <p className="text-2xl font-bold text-orange-900 mt-1">
                        {metricsLoading ? '...' : dashboardMetrics.pendingDeliveries}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Entregas pendientes y en tránsito
                      </p>
                    </div>
                    <Package className="h-10 w-10 text-orange-600" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

