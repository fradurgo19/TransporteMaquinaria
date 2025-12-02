import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { Badge } from '../atoms/Badge';
import { ArrowLeft, MapPin, Clock, Plus } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { format, parseISO } from 'date-fns';
import { useDeliveries, useDeliveryTracking, useDeliveriesMutation } from '../hooks/useDeliveries';
import { useGeolocation } from '../hooks/useGeolocation';
import { DeliveryStatus } from '../types';

export const TrackingPage: React.FC = () => {
  useProtectedRoute(['logistics']);
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const [showAddTracking, setShowAddTracking] = useState(false);

  const { data: deliveriesData } = useDeliveries({ limit: 100 });
  const { data: trackingData } = useDeliveryTracking(deliveryId || '');
  const { updateDelivery, addTracking } = useDeliveriesMutation();

  const delivery = deliveriesData?.data.find(d => d.id === deliveryId);
  const trackingHistory = trackingData || [];

  const [trackingForm, setTrackingForm] = useState({
    status: delivery?.status || 'pending',
    location: '',
    notes: '',
  });

  const handleAddTracking = async () => {
    if (!deliveryId) return;

    try {
      await addTracking.mutateAsync({
        delivery_id: deliveryId,
        status: trackingForm.status as DeliveryStatus,
        location: trackingForm.location,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        notes: trackingForm.notes,
      });

      await updateDelivery.mutateAsync({
        id: deliveryId,
        updates: { status: trackingForm.status as DeliveryStatus },
      });

      setShowAddTracking(false);
      setTrackingForm({
        status: trackingForm.status,
        location: '',
        notes: '',
      });
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error al agregar tracking: ${error.message}`);
    }
  };

  const getStatusLabel = (status: DeliveryStatus) => {
    const labels: Record<DeliveryStatus, string> = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      in_transit: 'En Tránsito',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    };
    return labels[status];
  };

  const getStatusColor = (status: DeliveryStatus) => {
    const colors: Record<DeliveryStatus, string> = {
      pending: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status];
  };

  if (!delivery) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Entrega no encontrada</p>
          <Button onClick={() => navigate('/deliveries')} className="mt-4">
            Volver a Entregas
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Modal Agregar Tracking */}
      {showAddTracking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Actualizar Estado</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Select
                  label="Estado *"
                  value={trackingForm.status}
                  onChange={(e) => setTrackingForm({ ...trackingForm, status: e.target.value })}
                  options={[
                    { value: 'pending', label: 'Pendiente' },
                    { value: 'assigned', label: 'Asignado' },
                    { value: 'in_transit', label: 'En Tránsito' },
                    { value: 'delivered', label: 'Entregado' },
                    { value: 'cancelled', label: 'Cancelado' },
                  ]}
                />

                <Input
                  label="Ubicación"
                  value={trackingForm.location}
                  onChange={(e) => setTrackingForm({ ...trackingForm, location: e.target.value })}
                  placeholder="Ej: Bodega Medellín, Ruta 45..."
                />

                {latitude && longitude && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                <TextArea
                  label="Notas"
                  value={trackingForm.notes}
                  onChange={(e) => setTrackingForm({ ...trackingForm, notes: e.target.value })}
                  placeholder="Observaciones sobre esta actualización..."
                  rows={3}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowAddTracking(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddTracking}
                    disabled={addTracking.isPending}
                  >
                    {addTracking.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/deliveries')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tracking de Entrega</h1>
              <p className="text-sm text-gray-600 font-mono">{delivery.tracking_number}</p>
            </div>
          </div>
          <Button onClick={() => setShowAddTracking(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Actualizar Estado
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información de la Entrega */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Detalles de Entrega</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500">Estado Actual</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor(delivery.status)}`}>
                    {getStatusLabel(delivery.status)}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{delivery.customer_name}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Dirección de Entrega</p>
                  <p className="text-sm text-gray-900">{delivery.delivery_address}</p>
                </div>

                {delivery.assigned_vehicle && (
                  <div>
                    <p className="text-xs text-gray-500">Vehículo Asignado</p>
                    <p className="text-sm font-medium text-gray-900">{delivery.assigned_vehicle}</p>
                  </div>
                )}

                {delivery.assigned_driver && (
                  <div>
                    <p className="text-xs text-gray-500">Conductor</p>
                    <p className="text-sm font-medium text-gray-900">{delivery.assigned_driver}</p>
                  </div>
                )}

                {delivery.notes && (
                  <div>
                    <p className="text-xs text-gray-500">Notas</p>
                    <p className="text-sm text-gray-700">{delivery.notes}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500">Fecha de Creación</p>
                  <p className="text-sm text-gray-900">
                    {format(parseISO(delivery.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Historial de Tracking */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Historial de Tracking</h2>
              </CardHeader>
              <CardBody>
                {trackingHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No hay actualizaciones registradas</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Línea vertical */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    <div className="space-y-6">
                      {trackingHistory.map((track, index) => (
                        <div key={track.id} className="relative flex gap-4">
                          {/* Punto en la línea */}
                          <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(track.status)}`}>
                            <MapPin className="h-5 w-5" />
                          </div>

                          {/* Contenido */}
                          <div className="flex-1 bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {getStatusLabel(track.status)}
                              </h3>
                              <span className="text-xs text-gray-500">
                                {format(parseISO(track.created_at), 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>

                            {track.location && (
                              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {track.location}
                              </p>
                            )}

                            {track.notes && (
                              <p className="text-sm text-gray-700">{track.notes}</p>
                            )}

                            {track.latitude && track.longitude && (
                              <p className="text-xs text-gray-500 mt-2">
                                GPS: {track.latitude}, {track.longitude}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

