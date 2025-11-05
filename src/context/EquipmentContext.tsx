import React, { createContext, useContext, useEffect, useState } from 'react';

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
  };

  return <EquipmentContext.Provider value={value}>{children}</EquipmentContext.Provider>;
};

