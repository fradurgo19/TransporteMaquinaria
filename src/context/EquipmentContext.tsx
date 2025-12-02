import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface Equipment {
  id: string;
  license_plate: string;
  driver_name: string;
  brand: string;
  vehicle_type: 'tractor' | 'trailer';
  serial_number: string;
}

interface EquipmentContextType {
  selectedEquipment: Equipment | null;
  selectEquipment: (equipment: Equipment) => void;
  clearEquipment: () => void;
  isEquipmentSelected: boolean;
  autoSelectAssignedEquipment: (userId: string) => Promise<boolean>;
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

export const useEquipment = () => {
  const context = useContext(EquipmentContext);
  if (!context) {
    throw new Error('useEquipment must be used within EquipmentProvider');
  }
  return context;
};

interface EquipmentProviderProps {
  children: React.ReactNode;
}

export const EquipmentProvider: React.FC<EquipmentProviderProps> = ({ children }) => {
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Cargar equipo seleccionado del localStorage al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('selectedEquipment');
    if (saved) {
      try {
        setSelectedEquipment(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved equipment:', error);
        localStorage.removeItem('selectedEquipment');
      }
    }
  }, []);

  // Función para auto-seleccionar vehículo asignado
  const autoSelectAssignedEquipment = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, license_plate, driver_name, brand, vehicle_type, serial_number')
        .eq('assigned_driver_id', userId)
        .eq('status', 'active')
        .eq('department', 'transport')
        .single();

      if (error || !data) {
        console.log('No hay vehículo asignado para este usuario');
        return false;
      }

      const equipment: Equipment = {
        id: data.id,
        license_plate: data.license_plate,
        driver_name: data.driver_name,
        brand: data.brand,
        vehicle_type: data.vehicle_type as 'tractor' | 'trailer',
        serial_number: data.serial_number,
      };

      setSelectedEquipment(equipment);
      localStorage.setItem('selectedEquipment', JSON.stringify(equipment));
      console.log('✅ Vehículo asignado automáticamente:', data.license_plate);
      return true;
    } catch (error) {
      console.error('Error auto-seleccionando equipo:', error);
      return false;
    }
  };

  const selectEquipment = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    localStorage.setItem('selectedEquipment', JSON.stringify(equipment));
  };

  const clearEquipment = () => {
    setSelectedEquipment(null);
    localStorage.removeItem('selectedEquipment');
  };

  const value: EquipmentContextType = {
    selectedEquipment,
    selectEquipment,
    clearEquipment,
    isEquipmentSelected: !!selectedEquipment,
    autoSelectAssignedEquipment,
  };

  return <EquipmentContext.Provider value={value}>{children}</EquipmentContext.Provider>;
};

