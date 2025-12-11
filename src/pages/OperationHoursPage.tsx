import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Input } from '../atoms/Input';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Clock, CheckCircle, Plus, X, RefreshCw, AlertCircle } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format, parseISO } from 'date-fns';
import { useOperationHours, useActiveOperationHour, useOperationHoursMutation } from '../hooks/useOperationHours';
import { supabase } from '../services/supabase';
import { useEquipment as useEquipmentHook } from '../hooks/useEquipment';
import { Select } from '../atoms/Select';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { useQueryClient } from '@tanstack/react-query';

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
  const { 
    data: operationHoursData, 
    isLoading, 
    error: operationHoursError,
    isError,
    refetch: refetchOperationHours
  } = useOperationHours({
    vehiclePlate: isAdmin ? undefined : selectedEquipment?.license_plate,
  });

  const { data: activeRecord } = useActiveOperationHour(selectedEquipment?.license_plate);
  
  const { startWork, finishWork } = useOperationHoursMutation();
  const queryClient = useQueryClient();
      
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

  const handleManualCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Validación de campos requeridos
    if (!manualFormData.vehicle_plate || !manualFormData.driver_name) {
      alert('Por favor completa los campos requeridos: Placa del Vehículo y Nombre del Conductor');
      return;
    }

    // Si no es compensatorio, validar hora de entrada
    if (!manualFormData.is_compensatory && !manualFormData.check_in_time) {
      alert('Por favor ingresa la Hora de Entrada');
      return;
    }

    // Si es compensatorio, validar fecha
    if (manualFormData.is_compensatory && !manualFormData.check_in_time) {
      alert('Por favor ingresa la Fecha del Día Compensatorio');
      return;
    }

    try {
      // Construir payload con campos requeridos del schema base
      const payload: any = {
        vehicle_plate: manualFormData.vehicle_plate,
        driver_name: manualFormData.driver_name,
        task_description: manualFormData.is_compensatory 
          ? 'Día Compensatorio' 
          : (manualFormData.notes || 'Registro manual por admin'),
        activity_type: 'regular',
        // Campos de ubicación GPS (requeridos NOT NULL en el schema)
        location_latitude: latitude || 4.6097, // Bogotá por defecto si no hay GPS
        location_longitude: longitude || -74.0817, // Bogotá por defecto si no hay GPS
        created_by: user?.id,
      };

      // Nota: Los siguientes campos pueden no existir si las migraciones no se ejecutaron:
      // - department: se agrega en logistics_setup.sql
      // - is_compensatory, notes: se agregan en add_compensatory_field.sql
      // Si estos campos no existen, el insert fallará con un error específico
      // que será manejado en el catch más abajo

      if (manualFormData.is_compensatory) {
        // Compensatorio: solo fecha, sin horas
        // Convertir fecha a formato ISO con hora 00:00:00
        const dateStr = manualFormData.check_in_time;
        // Asegurar formato ISO completo: YYYY-MM-DDTHH:mm:ss
        payload.check_in_time = dateStr.includes('T') 
          ? dateStr.split('T')[0] + 'T00:00:00'
          : `${dateStr}T00:00:00`;
        // Para días compensatorios, usar el mismo tiempo de entrada y salida
        // (0 horas trabajadas) y marcarlo como completado
        payload.check_out_time = payload.check_in_time;
        payload.status = 'completed'; // Status válido según schema: 'in_progress', 'completed', 'cancelled'
      } else {
        // Normal: con horas de entrada y salida
        // Convertir datetime-local (YYYY-MM-DDTHH:mm) a ISO string completo (YYYY-MM-DDTHH:mm:ss)
        let checkInISO = manualFormData.check_in_time;
        if (checkInISO && !checkInISO.includes(':')) {
          // Si solo tiene fecha, agregar hora 00:00:00
          checkInISO = `${checkInISO}T00:00:00`;
        } else if (checkInISO && checkInISO.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          // Si tiene formato YYYY-MM-DDTHH:mm, agregar segundos
          checkInISO = `${checkInISO}:00`;
        }
        payload.check_in_time = checkInISO;
        
        if (manualFormData.check_out_time) {
          let checkOutISO = manualFormData.check_out_time;
          if (checkOutISO && checkOutISO.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            // Si tiene formato YYYY-MM-DDTHH:mm, agregar segundos
            checkOutISO = `${checkOutISO}:00`;
          }
          payload.check_out_time = checkOutISO;
          payload.status = 'completed';
        } else {
          payload.check_out_time = null;
          payload.status = 'in_progress';
        }
      }

      console.log('📝 Creando registro manual con payload:', payload);

      // Usar interceptor para manejar auto-refresh de sesión
      const result = await executeSupabaseQuery(() =>
        supabase
        .from('operation_hours')
        .insert([payload])
          .select()
      );

      if (result.error) {
        console.error('❌ Error al crear registro:', result.error);
        alert(`Error al crear registro: ${result.error.message || 'Error desconocido'}`);
        return;
      }

      console.log('✅ Registro manual creado exitosamente:', result.data);
      
      // Invalidar queries para refrescar la lista
      queryClient.invalidateQueries({ 
        queryKey: ['operation_hours'],
        refetchType: 'active',
      });
      
      alert('✅ Registro creado exitosamente');
      
      // Cerrar modal y limpiar formulario
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
      console.error('❌ Excepción al crear registro:', error);
      alert(`Error: ${error.message || 'Error desconocido al crear el registro'}`);
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Horas de Operación</h1>
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
                <form onSubmit={handleManualCreate} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualFormData.is_compensatory}
                        onChange={(e) => {
                          setManualFormData({ 
                            ...manualFormData, 
                            is_compensatory: e.target.checked,
                            // Limpiar check_out_time cuando se marca como compensatorio
                            check_out_time: e.target.checked ? '' : manualFormData.check_out_time
                          });
                        }}
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
                    <Button 
                      type="button"
                      variant="secondary" 
                      onClick={() => {
                        setShowManualForm(false);
                        setManualFormData({
                          vehicle_plate: '',
                          driver_name: '',
                          check_in_time: '',
                          check_out_time: '',
                          is_compensatory: false,
                          notes: '',
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      Crear Registro
                    </Button>
                  </div>
                </form>
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
              {isError && (
                <span className="text-sm text-red-500">
                  Error al cargar datos
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {isError ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-2 font-semibold">
                  Error al cargar las horas de operación
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {operationHoursError instanceof Error 
                    ? (operationHoursError.message.includes('Timeout') 
                        ? 'La consulta tardó demasiado. Verifica tu conexión.'
                        : operationHoursError.message)
                    : 'Error desconocido'}
                </p>
                <Button 
                  variant="secondary" 
                  onClick={() => refetchOperationHours()}
                  className="mr-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => window.location.reload()}
                >
                  Recargar página
                </Button>
              </div>
            ) : (
            <DataTable
              data={operationHours}
              columns={columns}
                emptyMessage={
                  isAdmin 
                    ? "No hay horas registradas" 
                    : selectedEquipment 
                      ? `No hay horas registradas para ${selectedEquipment.license_plate}`
                      : "Selecciona un vehículo para ver sus horas registradas"
                }
              />
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
