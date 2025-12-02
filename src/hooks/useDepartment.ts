import { useAuth } from '../context/AuthContext';

/**
 * Hook para obtener el departamento del usuario actual
 * - transport: Transporte de maquinaria
 * - logistics: Logística y entregas
 */
export const useDepartment = () => {
  const { user } = useAuth();

  const department = (user?.role === 'logistics' || user?.role === 'admin_logistics') ? 'logistics' : 'transport';
  const isLogistics = department === 'logistics';
  const isTransport = department === 'transport';
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';
  const isDepartmentAdmin = 
    (isTransport && user?.role === 'admin') || 
    (isLogistics && user?.role === 'admin_logistics');

  return {
    department,
    isLogistics,
    isTransport,
    isAdmin,
    isDepartmentAdmin,
  };
};

