import { useAuth } from '../context/AuthContext';

/**
 * Hook para obtener el departamento del usuario actual
 * - transport: Transporte de maquinaria
 * - logistics: Logística y entregas
 */
export const useDepartment = () => {
  const { user } = useAuth();

  const department = user?.role === 'logistics' ? 'logistics' : 'transport';
  const isLogistics = department === 'logistics';
  const isTransport = department === 'transport';

  return {
    department,
    isLogistics,
    isTransport,
  };
};

