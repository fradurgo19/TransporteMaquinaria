import React, { useState, useEffect } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, Clock, Edit, CheckCircle, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format, parseISO } from 'date-fns';

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
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const [operationHours, setOperationHours] = useState<OperationHour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRecord, setActiveRecord] = useState<OperationHour | null>(null);

  useEffect(() => {
    fetchOperationHours();
  }, [selectedEquipment]);

  useEffect(() => {
    // Buscar registro activo (in_progress) del vehículo actual
    const active = operationHours.find(h => h.status === 'in_progress');
    setActiveRecord(active || null);
  }, [operationHours]);

  const fetchOperationHours = async () => {
    try {
      setIsLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/operation_hours?vehicle_plate=eq.${selectedEquipment?.license_plate}&order=check_in_time.desc&limit=20`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOperationHours(data);
      }
    } catch (error) {
      console.error('Error cargando horas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const now = new Date().toISOString();
      
      const payload = {
        vehicle_plate: selectedEquipment?.license_plate,
        driver_name: user?.full_name || user?.username,
        check_in_time: now,
        check_out_time: null,
        task_description: 'Operación registrada automáticamente',
        location_latitude: latitude || 4.6097,
        location_longitude: longitude || -74.0817,
        activity_type: 'regular',
        status: 'in_progress',
        created_by: user?.id,
      };

      console.log('🟢 Iniciando jornada:', payload);

      const response = await fetch(
        `${supabaseUrl}/rest/v1/operation_hours`,
        {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        console.log('✅ Jornada iniciada');
        await fetchOperationHours();
      } else {
        const errorData = await response.json();
        console.error('❌ Error:', errorData);
        alert('Error al iniciar jornada');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al iniciar jornada');
    }
  };

  const handleFinishWork = async () => {
    if (!activeRecord) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const now = new Date().toISOString();
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/operation_hours?id=eq.${activeRecord.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            check_out_time: now,
            status: 'completed',
          }),
        }
      );

      if (response.ok) {
        console.log('✅ Jornada finalizada');
        await fetchOperationHours();
      } else {
        const errorData = await response.json();
        console.error('❌ Error:', errorData);
        alert('Error al finalizar jornada');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al finalizar jornada');
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
                    disabled={!selectedEquipment}
                  >
                    <Clock className="h-5 w-5 mr-2" />
                    Iniciar Jornada
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
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Finalizar Jornada
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
