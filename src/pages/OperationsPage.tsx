import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, Activity, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format } from 'date-fns';

export const OperationsPage: React.FC = () => {
  useProtectedRoute(['admin', 'user']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const [showForm, setShowForm] = useState(false);
  
  // Estados del formulario con valores por defecto
  const [formData, setFormData] = useState({
    vehiclePlate: selectedEquipment?.license_plate || '',
    driverName: user?.full_name || user?.username || '', // Usuario logueado, NO el asignado al vehículo
    operationType: 'loading',
    cargoDescription: '',
    cargoWeight: '',
    origin: '',
    destination: '',
    notes: '',
  });

  const mockOperations = [
    {
      id: '1',
      vehiclePlate: 'ABC-123',
      operationType: 'loading',
      timestamp: '2025-11-04T08:15:00',
      cargo: 'Excavadora Caterpillar 320D',
      origin: 'Bogotá',
      destination: 'Chía',
    },
  ];

  const columns = [
    { key: 'vehiclePlate', label: 'Vehículo', sortable: true },
    {
      key: 'operationType',
      label: 'Tipo',
      render: (item: any) => {
        const types = {
          loading: 'Carga',
          route_start: 'Inicio Ruta',
          delivery: 'Entrega',
        };
        return types[item.operationType as keyof typeof types] || item.operationType;
      },
    },
    {
      key: 'timestamp',
      label: 'Fecha/Hora',
      render: (item: any) => format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm'),
    },
    { key: 'cargo', label: 'Carga' },
    { key: 'origin', label: 'Origen' },
    { key: 'destination', label: 'Destino' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Operaciones</h1>
            <p className="mt-2 text-gray-600">
              Registra carga, inicio de ruta y entregas
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Registrar Operación'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Registrar Operación
              </h2>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                const payload = {
                  ...formData,
                  gps_latitude: latitude || 4.6097,
                  gps_longitude: longitude || -74.0817,
                  created_by: user?.id,
                };
                console.log('🚚 Guardando operación:', payload);
                alert('Guardado a Supabase implementar próximamente');
              }}>
                {/* Información del Equipo (Solo lectura) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Equipo Seleccionado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Placa del Vehículo</label>
                      <p className="text-lg font-bold text-blue-900">{selectedEquipment?.license_plate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Conductor (Usuario Actual)</label>
                      <p className="text-lg font-bold text-blue-900">{user?.full_name || user?.username}</p>
                    </div>
                  </div>
                </div>

                {/* Ubicación GPS */}
                <div className={`rounded-lg p-4 mb-4 border ${
                  latitude && longitude 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center">
                      <MapPin className={`h-4 w-4 mr-2 ${latitude && longitude ? 'text-green-600' : 'text-yellow-600'}`} />
                      Ubicación GPS
                    </h3>
                    {!geoLoading && (
                      <button
                        type="button"
                        onClick={refreshLocation}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Actualizar
                      </button>
                    )}
                  </div>
                  {geoLoading ? (
                    <p className="text-xs text-gray-600">Obteniendo ubicación...</p>
                  ) : latitude && longitude ? (
                    <p className="text-xs text-green-700">
                      ✓ Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-700">
                      ⚠ {geoError || 'Ubicación no disponible'}
                    </p>
                  )}
                </div>

                <Select
                  label="Tipo de Operación"
                  value={formData.operationType}
                  onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                  options={[
                    { value: 'loading', label: 'Carga' },
                    { value: 'route_start', label: 'Inicio de Ruta' },
                    { value: 'delivery', label: 'Entrega' },
                  ]}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Origen"
                    placeholder="Ej: Bogotá - Bodega Central"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    required
                  />
                  <Input
                    label="Destino"
                    placeholder="Ej: Chía - Obra Los Arrayanes"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    required
                  />
                </div>

                <TextArea
                  label="Descripción de la Carga"
                  rows={2}
                  value={formData.cargoDescription}
                  onChange={(e) => setFormData({ ...formData, cargoDescription: e.target.value })}
                  placeholder="Ej: Excavadora Caterpillar 320D"
                  required
                />

                <Input
                  type="number"
                  label="Peso de la Carga (kg)"
                  step="0.01"
                  placeholder="0"
                  value={formData.cargoWeight}
                  onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                />

                <TextArea
                  label="Notas Adicionales"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones, instrucciones especiales, etc..."
                />

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Guardar Operación
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Operaciones</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={mockOperations}
              columns={columns}
              emptyMessage="No hay operaciones registradas"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
