import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Input } from '../atoms/Input';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Clock, CheckCircle, Plus, X } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format, parseISO } from 'date-fns';
import { useOperationHours, useActiveOperationHour, useOperationHoursMutation } from '../hooks/useOperationHours';
import { supabase } from '../services/supabase';
import { useEquipment as useEquipmentHook } from '../hooks/useEquipment';
import { Select } from '../atoms/Select';

interface OperationHour {
  id: string;
  vehicle_plate: string;
  driver_name: string;
  check_in_time: string;
  check_out_time: string | null;
  task_description: string;
  activity_type: string;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  status: string;
  created_at: string;
}

export const OperationHoursPage: React.FC = () => {
  useProtectedRoute(['admin', 'user']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude } = useGeolocation();
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    vehicle_plate: '',
    driver_name: '',
    check_in_time: '',
    check_out_time: '',
    is_compensatory: false,
    notes: '',
  });

  // Admins ven todos los registros, usuarios solo los de su vehículo
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';
  
  // Usar hooks optimizados de React Query
  const { data: operationHoursData, isLoading } = useOperationHours({
    vehiclePlate: isAdmin ? undefined : selectedEquipment?.license_plate,
  });

  const { data: activeRecord } = useActiveOperationHour(selectedEquipment?.license_plate);
  
  const { startWork, finishWork } = useOperationHoursMutation();

  const operationHours = operationHoursData?.data || [];

  // Obtener lista de vehículos y conductores para el formulario manual
  const { data: equipmentListData } = useEquipmentHook({ 
    limit: 100, 
    status: 'active',
    useFullFields: false 
  });
  
  const vehiclesList = equipmentListData?.data || [];
  const uniqueDrivers = [...new Set(vehiclesList.map(v => v.driver_name))].filter(Boolean);

  const handleStartWork = async () => {
    if (!selectedEquipment?.license_plate || !user) {
      alert('Selecciona un equipo para iniciar la jornada');
      return;
    }

    try {
      const now = new Date().toISOString();
      
      await startWork.mutateAsync({
        vehicle_plate: selectedEquipment.license_plate,
        driver_name: user.full_name || user.username || '',
        check_in_time: now,
        task_description: 'Operación registrada automáticamente',
        location_latitude: latitude || 4.6097,
        location_longitude: longitude || -74.0817,
        activity_type: 'regular',
        created_by: user.id,
      });

      console.log('✅ Jornada iniciada');
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(`Error al iniciar jornada: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleFinishWork = async () => {
    if (!activeRecord) return;

    try {
      const now = new Date().toISOString();
      
      await finishWork.mutateAsync({
        id: activeRecord.id,
        checkOutTime: now,
      });

      console.log('✅ Jornada finalizada');
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(`Error al finalizar jornada: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleManualCreate = async () => {
    if (!manualFormData.vehicle_plate || !manualFormData.driver_name) {
      alert('Completa los campos requeridos');
      return;
    }

    try {
      const payload: any = {
        vehicle_plate: manualFormData.vehicle_plate,
        driver_name: manualFormData.driver_name,
        task_description: manualFormData.is_compensatory ? 'Día Compensatorio' : 'Registro manual por admin',
        activity_type: 'regular',
        department: 'transport',
        created_by: user?.id,
        created_by_admin: true,
        is_compensatory: manualFormData.is_compensatory,
        notes: manualFormData.notes,
      };

      if (manualFormData.is_compensatory) {
        // Compensatorio: solo fecha, sin horas
        payload.check_in_time = `${manualFormData.check_in_time}T00:00:00`;
        payload.check_out_time = null;
        payload.status = 'compensatory';
      } else {
        // Normal: con horas de entrada y salida
        payload.check_in_time = manualFormData.check_in_time;
        payload.check_out_time = manualFormData.check_out_time || null;
        payload.status = manualFormData.check_out_time ? 'completed' : 'in_progress';
      }

      const { data, error } = await supabase
        .from('operation_hours')
        .insert([payload])
        .select();

      if (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
        return;
      }

      console.log('✅ Registro manual creado:', data);
      alert('✅ Registro creado exitosamente');
      
      setShowManualForm(false);
      setManualFormData({
        vehicle_plate: '',
        driver_name: '',
        check_in_time: '',
        check_out_time: '',
        is_compensatory: false,
        notes: '',
      });
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const columns = [
    { 
      key: 'driver_name', 
      label: 'Conductor', 
      sortable: true 
    },
    {
      key: 'check_in_time',
      label: 'Entrada',
      render: (item: OperationHour) => format(parseISO(item.check_in_time), 'dd/MM/yy HH:mm'),
    },
    {
      key: 'check_out_time',
      label: 'Salida',
      render: (item: OperationHour) => 
        item.check_out_time 
          ? format(parseISO(item.check_out_time), 'dd/MM/yy HH:mm')
          : <span className="text-yellow-600 font-semibold">En Progreso</span>,
    },
    { 
      key: 'total_hours', 
      label: 'Total Hrs',
      render: (item: OperationHour) => item.total_hours ? `${item.total_hours} hrs` : '-',
    },
    { 
      key: 'regular_hours', 
      label: 'Regulares',
      render: (item: OperationHour) => item.regular_hours ? `${item.regular_hours} hrs` : '-',
    },
    { 
      key: 'overtime_hours', 
      label: 'Extras',
      render: (item: OperationHour) => item.overtime_hours ? `${item.overtime_hours} hrs` : '-',
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: any) => {
        if (item.is_compensatory) {
          return <Badge variant="info">Compensatorio</Badge>;
        }
        return item.status === 'in_progress' ? (
          <Badge variant="warning">En Progreso</Badge>
        ) : (
          <Badge variant="success">Completado</Badge>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Horas de Operación</h1>
            <p className="mt-2 text-gray-600">
              Registra tu jornada de trabajo automáticamente
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowManualForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registro Manual
            </Button>
          )}
        </div>

        {/* Modal de Registro Manual (solo admin) */}
        {showManualForm && isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Registro Manual de Horas</h2>
                  <button onClick={() => setShowManualForm(false)}>
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualFormData.is_compensatory}
                        onChange={(e) => setManualFormData({ ...manualFormData, is_compensatory: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-blue-900">
                        Marcar como Día Compensatorio (sin horas de trabajo)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Placa del Vehículo *"
                      value={manualFormData.vehicle_plate}
                      onChange={(e) => {
                        const selectedVehicle = vehiclesList.find(v => v.license_plate === e.target.value);
                        setManualFormData({ 
                          ...manualFormData, 
                          vehicle_plate: e.target.value,
                          driver_name: selectedVehicle?.driver_name || manualFormData.driver_name
                        });
                      }}
                      options={[
                        { value: '', label: 'Seleccionar vehículo...' },
                        ...vehiclesList
                          .filter(v => v.vehicle_type !== 'trailer')
                          .map(v => ({
                            value: v.license_plate,
                            label: `${v.license_plate} - ${v.driver_name}`
                          }))
                      ]}
                      required
                    />
                    <Select
                      label="Nombre del Conductor *"
                      value={manualFormData.driver_name}
                      onChange={(e) => setManualFormData({ ...manualFormData, driver_name: e.target.value })}
                      options={[
                        { value: '', label: 'Seleccionar conductor...' },
                        ...uniqueDrivers.map(driver => ({
                          value: driver,
                          label: driver
                        }))
                      ]}
                      required
                    />
                  </div>

                  {!manualFormData.is_compensatory && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          type="datetime-local"
                          label="Hora de Entrada *"
                          value={manualFormData.check_in_time}
                          onChange={(e) => setManualFormData({ ...manualFormData, check_in_time: e.target.value })}
                          required
                        />
                        <Input
                          type="datetime-local"
                          label="Hora de Salida"
                          value={manualFormData.check_out_time}
                          onChange={(e) => setManualFormData({ ...manualFormData, check_out_time: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {manualFormData.is_compensatory && (
                    <Input
                      type="date"
                      label="Fecha del Día Compensatorio *"
                      value={manualFormData.check_in_time}
                      onChange={(e) => setManualFormData({ ...manualFormData, check_in_time: e.target.value })}
                      required
                    />
                  )}

                  <TextArea
                    label="Notas"
                    value={manualFormData.notes}
                    onChange={(e) => setManualFormData({ ...manualFormData, notes: e.target.value })}
                    placeholder="Motivo, observaciones..."
                    rows={3}
                  />

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={() => setShowManualForm(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleManualCreate}>
                      Crear Registro
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Botones de Control */}
        <Card>
          <CardBody>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-6">
              {/* Información del equipo */}
              <div className="text-center md:text-left">
                <p className="text-sm text-gray-600">Vehículo</p>
                <p className="text-xl font-bold text-gray-900">{selectedEquipment?.license_plate}</p>
                <p className="text-sm text-gray-600">{user?.full_name || user?.username}</p>
                {latitude && longitude && (
                  <p className="text-xs text-green-600 mt-1">
                    📍 GPS: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                {!activeRecord ? (
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 px-8 py-4"
                    onClick={handleStartWork}
                    disabled={!selectedEquipment || startWork.isPending}
                  >
                    <Clock className="h-5 w-5 mr-2" />
                    {startWork.isPending ? 'Iniciando...' : 'Iniciar Jornada'}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <p className="text-xs text-green-700">Jornada en curso desde:</p>
                      <p className="text-sm font-bold text-green-900">
                        {format(parseISO(activeRecord.check_in_time), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      variant="warning"
                      className="px-8 py-4"
                      onClick={handleFinishWork}
                      disabled={finishWork.isPending}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      {finishWork.isPending ? 'Finalizando...' : 'Finalizar Jornada'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Registro de Horas</h2>
              {isLoading && <span className="text-sm text-gray-500">Cargando...</span>}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={operationHours}
              columns={columns}
              emptyMessage="No hay horas registradas para este vehículo"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
