import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, ClipboardCheck, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format } from 'date-fns';

export const ChecklistPage: React.FC = () => {
  useProtectedRoute(['admin', 'user']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const [showForm, setShowForm] = useState(false);
  
  // Estados del formulario con valores por defecto
  const [formData, setFormData] = useState({
    vehiclePlate: selectedEquipment?.license_plate || '',
    driverName: user?.full_name || user?.username || '', // Usuario logueado, NO el asignado al vehículo
    checkDate: format(new Date(), 'yyyy-MM-dd'),
    tireCondition: 'good',
    brakeCondition: 'good',
    lightsCondition: 'good',
    fluidLevels: 'good',
    engineCondition: 'good',
    vehicleConditionAssessment: '',
    passed: true,
  });

  const mockChecklists = [
    {
      id: '1',
      vehiclePlate: 'ABC-123',
      driverName: 'Juan Pérez',
      checkDate: '2025-11-04',
      passed: true,
      assessment: 'Vehículo en excelentes condiciones',
    },
  ];

  const columns = [
    { key: 'vehiclePlate', label: 'Vehículo', sortable: true },
    { key: 'driverName', label: 'Conductor', sortable: true },
    {
      key: 'checkDate',
      label: 'Fecha',
      render: (item: any) => format(new Date(item.checkDate), 'dd/MM/yyyy'),
    },
    {
      key: 'passed',
      label: 'Estado',
      render: (item: any) =>
        item.passed ? (
          <span className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            Aprobado
          </span>
        ) : (
          <span className="flex items-center text-red-600">
            <XCircle className="h-4 w-4 mr-1" />
            Rechazado
          </span>
        ),
    },
    { key: 'assessment', label: 'Evaluación' },
  ];

  const conditionOptions = [
    { value: 'good', label: 'Bueno' },
    { value: 'fair', label: 'Regular' },
    { value: 'poor', label: 'Malo' },
    { value: 'critical', label: 'Crítico' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Checklist Pre-Operacional</h1>
            <p className="mt-2 text-gray-600">
              Inspección diaria del vehículo antes de operar
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nueva Inspección'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <ClipboardCheck className="h-5 w-5 mr-2" />
                Inspección Pre-Operacional
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
                console.log('✅ Guardando checklist:', payload);
                alert('Guardado a Supabase implementar próximamente');
              }}>
                {/* Información del Equipo (Solo lectura) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Equipo a Inspeccionar</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Placa del Vehículo</label>
                      <p className="text-lg font-bold text-blue-900">{selectedEquipment?.license_plate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Conductor (Usuario Actual)</label>
                      <p className="text-lg font-bold text-blue-900">{user?.full_name || user?.username}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Fecha de Inspección</label>
                      <p className="text-sm text-blue-800">{format(new Date(), 'dd/MM/yyyy')}</p>
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

                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Condiciones del Vehículo</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Condición de Neumáticos"
                    value={formData.tireCondition}
                    onChange={(e) => setFormData({ ...formData, tireCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Condición de Frenos"
                    value={formData.brakeCondition}
                    onChange={(e) => setFormData({ ...formData, brakeCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Condición de Luces"
                    value={formData.lightsCondition}
                    onChange={(e) => setFormData({ ...formData, lightsCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Niveles de Fluidos"
                    value={formData.fluidLevels}
                    onChange={(e) => setFormData({ ...formData, fluidLevels: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Condición del Motor"
                    value={formData.engineCondition}
                    onChange={(e) => setFormData({ ...formData, engineCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                </div>

                <TextArea
                  label="Evaluación General del Vehículo"
                  rows={3}
                  value={formData.vehicleConditionAssessment}
                  onChange={(e) => setFormData({ ...formData, vehicleConditionAssessment: e.target.value })}
                  placeholder="Describe la condición general del vehículo, problemas encontrados, etc..."
                  required
                />

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.passed}
                      onChange={(e) => setFormData({ ...formData, passed: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      El vehículo está en condiciones de operar
                    </span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Guardar Inspección
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Inspecciones</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={mockChecklists}
              columns={columns}
              emptyMessage="No hay inspecciones registradas"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
