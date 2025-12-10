import { useAuth } from '../context/AuthContext';

/**
 * Hook para obtener el departamento del usuario actual
 * - transport: Transporte de maquinaria
 * - logistics: Logística y entregas
 */
export const useDepartment = () => {
  const { user, isLoading: authLoading } = useAuth();

  // Si el usuario está cargando o no hay usuario, retornar 'transport' por defecto
  // pero marcar como no listo
  const department = user 
    ? ((user.role === 'logistics' || user.role === 'admin_logistics') ? 'logistics' : 'transport')
    : 'transport';
  
  const isLogistics = department === 'logistics';
  const isTransport = department === 'transport';
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';
  const isDepartmentAdmin = 
    (isTransport && user?.role === 'admin') || 
    (isLogistics && user?.role === 'admin_logistics');

  return {
    department: department as 'transport' | 'logistics',
    isLogistics,
    isTransport,
    isAdmin,
    isDepartmentAdmin,
    isLoading: authLoading, // Exponer si está cargando
  };
};

