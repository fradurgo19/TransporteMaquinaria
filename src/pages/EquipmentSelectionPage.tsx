import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, CheckCircle, Loader, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEquipment } from '../context/EquipmentContext';
import { Card } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { useEquipment as useEquipmentHook } from '../hooks/useEquipment';

interface Equipment {
  id: string;
  license_plate: string;
  driver_name: string;
  brand: string;
  vehicle_type: 'tractor' | 'trailer';
  serial_number: string;
  status: string;
}

export const EquipmentSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectEquipment } = useEquipment();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Usar hook optimizado que incluye autenticación automáticamente
  const { 
    data: equipmentData, 
    isLoading, 
    error: equipmentError,
    refetch 
  } = useEquipmentHook({
    page: 1,
    limit: 100, // Mostrar todos los equipos activos
    status: 'active', // Solo equipos activos
    useFullFields: false,
  });

  const equipment = equipmentData?.data || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSelect = (equip: Equipment) => {
    console.log('🎯 Equipo seleccionado:', equip.license_plate, equip.id);
    setSelectedId(equip.id);
  };

  const handleConfirm = () => {
    console.log('✅ Confirmando selección, selectedId:', selectedId);
    const selected = equipment.find(e => e.id === selectedId);
    console.log('✅ Equipo encontrado:', selected);
    if (selected) {
      console.log('✅ Guardando equipo en contexto:', selected);
      // Mapear solo los campos necesarios para el contexto
      selectEquipment({
        id: selected.id,
        license_plate: selected.license_plate,
        driver_name: selected.driver_name,
        brand: selected.brand,
        vehicle_type: (selected.vehicle_type || 'tractor') as 'tractor' | 'trailer',
        serial_number: selected.serial_number,
      });
      console.log('✅ Navegando al dashboard...');
      navigate('/');
    } else {
      console.error('❌ No se encontró el equipo seleccionado');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando equipos...</p>
        </div>
      </div>
    );
  }

  if (equipmentError) {
    const errorMessage = equipmentError instanceof Error 
      ? equipmentError.message 
      : 'Error desconocido';
    
    const isPermissionError = errorMessage.includes('permission') || 
                             errorMessage.includes('policy') || 
                             errorMessage.includes('RLS') ||
                             errorMessage.includes('PGRST301');

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error al cargar equipos</h2>
          {isPermissionError ? (
            <>
              <p className="text-gray-600 mb-2">
                No tienes permisos para ver los equipos. Esto puede deberse a:
              </p>
              <ul className="text-left text-sm text-gray-600 mb-4 space-y-1 list-disc list-inside">
                <li>Las políticas RLS (Row Level Security) en Supabase no están configuradas correctamente</li>
                <li>Tu usuario no tiene el rol adecuado</li>
              </ul>
              <p className="text-xs text-gray-500 mb-4">
                Contacta al administrador del sistema para verificar los permisos.
              </p>
            </>
          ) : (
            <p className="text-gray-600 mb-4">
              {errorMessage}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => refetch()} variant="primary">
              Reintentar
            </Button>
            <Button onClick={handleLogout} variant="secondary">
              Cerrar Sesión
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Botón de cerrar sesión en la esquina superior */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={handleLogout}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Selecciona tu Equipo
          </h1>
          <p className="text-gray-600">
            Hola <span className="font-semibold">{user?.username}</span>, elige el vehículo que operarás hoy
          </p>
        </div>

        {equipment.length === 0 ? (
          <Card className="p-8 text-center">
            <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay equipos disponibles
            </h3>
            <p className="text-gray-600 mb-4">
              No se encontraron vehículos activos en el sistema.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => refetch()} variant="primary">
                Actualizar
              </Button>
              <Button onClick={handleLogout} variant="secondary">
                Cerrar Sesión
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {equipment.map((equip) => (
                <Card
                  key={equip.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedId === equip.id
                      ? 'ring-2 ring-primary bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelect(equip)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Badge variant="info" size="sm">
                        {equip.vehicle_type === 'tractor' ? 'Tractor' : 'Trailer'}
                      </Badge>
                    </div>
                    {selectedId === equip.id && (
                      <CheckCircle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {equip.license_plate}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {equip.brand}
                  </p>
                  
                  <p className="text-xs text-gray-500">
                    Serial: {equip.serial_number}
                  </p>
                </Card>
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleConfirm}
                disabled={!selectedId}
                size="lg"
                className="min-w-[200px]"
              >
                Confirmar Selección
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

