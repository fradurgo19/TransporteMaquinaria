import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { Badge } from '../atoms/Badge';
import { Plus, Package, Search, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { format, parseISO } from 'date-fns';
import { useDeliveries, useDeliveriesMutation } from '../hooks/useDeliveries';
import { DeliveryStatus } from '../types';
import { useNavigate } from 'react-router-dom';

export const DeliveriesPage: React.FC = () => {
  useProtectedRoute(['logistics']);
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: deliveriesData, isLoading } = useDeliveries({
    page: currentPage,
    search: searchTerm || undefined,
    status: statusFilter || undefined,
  });

  const { createDelivery } = useDeliveriesMutation();

  const deliveries = deliveriesData?.data || [];

  const [formData, setFormData] = useState({
    customer_name: '',
    delivery_address: '',
    assigned_vehicle: '',
    assigned_driver: '',
    pickup_date: '',
    notes: '',
  });

  const handleCreateDelivery = async () => {
    try {
      const trackingNumber = `LOG${format(new Date(), 'yyyyMMddHHmmss')}`;
      
      await createDelivery.mutateAsync({
        tracking_number: trackingNumber,
        customer_name: formData.customer_name,
        delivery_address: formData.delivery_address,
        assigned_vehicle: formData.assigned_vehicle,
        assigned_driver: formData.assigned_driver,
        pickup_date: formData.pickup_date,
        notes: formData.notes,
        status: 'pending',
      });

      setShowAddModal(false);
      setFormData({
        customer_name: '',
        delivery_address: '',
        assigned_vehicle: '',
        assigned_driver: '',
        pickup_date: '',
        notes: '',
      });
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error al crear entrega: ${error.message}`);
    }
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
      {/* Modal Crear Entrega */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Nueva Entrega</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Input
                  label="Cliente *"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Nombre del cliente"
                  required
                />

                <TextArea
                  label="Dirección de Entrega *"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  placeholder="Dirección completa de entrega"
                  rows={3}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Vehículo Asignado"
                    value={formData.assigned_vehicle}
                    onChange={(e) => setFormData({ ...formData, assigned_vehicle: e.target.value })}
                    placeholder="Placa del vehículo"
                  />

                  <Input
                    label="Conductor Asignado"
                    value={formData.assigned_driver}
                    onChange={(e) => setFormData({ ...formData, assigned_driver: e.target.value })}
                    placeholder="Nombre del conductor"
                  />
                </div>

                <Input
                  type="datetime-local"
                  label="Fecha de Recogida"
                  value={formData.pickup_date}
                  onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                />

                <TextArea
                  label="Notas"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instrucciones especiales, observaciones..."
                  rows={3}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateDelivery}
                    disabled={!formData.customer_name || !formData.delivery_address || createDelivery.isPending}
                  >
                    {createDelivery.isPending ? 'Creando...' : 'Crear Entrega'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Entregas</h1>
            <p className="mt-2 text-gray-600">
              Administra y rastrea todas las entregas
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Entrega
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Lista de Entregas</h2>
              
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por tracking, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'pending', label: 'Pendiente' },
                    { value: 'assigned', label: 'Asignado' },
                    { value: 'in_transit', label: 'En Tránsito' },
                    { value: 'delivered', label: 'Entregado' },
                    { value: 'cancelled', label: 'Cancelado' },
                  ]}
                />
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Cargando entregas...</p>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No hay entregas registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dirección</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-primary">
                          {delivery.tracking_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {delivery.customer_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {delivery.delivery_address}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {delivery.assigned_vehicle || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {getStatusBadge(delivery.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {delivery.created_at ? format(parseISO(delivery.created_at), 'dd/MM/yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/tracking/${delivery.id}`)}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            Tracking
                          </Button>
                        </td>
                      </tr>
                    ))}
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

