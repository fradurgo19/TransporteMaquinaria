import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEquipment } from '../context/EquipmentContext';
import { Card } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

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
  const { user } = useAuth();
  const { selectEquipment } = useEquipment();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setIsLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/equipment?status=eq.active&select=id,license_plate,driver_name,brand,vehicle_type,serial_number,status`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        }
      );

      if (!response.ok) throw new Error('Error cargando equipos');

      const data = await response.json();
      setEquipment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
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
      selectEquipment(selected);
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchEquipment} variant="primary">
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
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
            <p className="text-gray-600">
              No se encontraron vehículos activos en el sistema.
            </p>
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

