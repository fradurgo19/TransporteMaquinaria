import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { DataTable } from '../organisms/DataTable';
import { Clock, CheckCircle } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format, parseISO } from 'date-fns';
import { useOperationHours, useActiveOperationHour, useOperationHoursMutation } from '../hooks/useOperationHours';

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

  // Usar hooks optimizados de React Query
  const { data: operationHoursData, isLoading } = useOperationHours({
    vehiclePlate: selectedEquipment?.license_plate,
  });

  const { data: activeRecord } = useActiveOperationHour(selectedEquipment?.license_plate);
  
  const { startWork, finishWork } = useOperationHoursMutation();

  const operationHours = operationHoursData?.data || [];

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
      render: (item: OperationHour) => 
        item.status === 'in_progress' ? (
          <Badge variant="warning">En Progreso</Badge>
        ) : (
          <Badge variant="success">Completado</Badge>
        ),
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
        </div>

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
