import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Clock,
  Fuel,
  Activity,
  ClipboardCheck,
  FileText,
  Package,
  MapPin,
  Calculator,
  LogOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEquipment } from '../context/EquipmentContext';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectedEquipment, clearEquipment } = useEquipment();

  const handleLogout = async () => {
    await logout();
    clearEquipment();
    navigate('/login');
  };

  const handleChangeEquipment = () => {
    clearEquipment();
    navigate('/equipment-selection');
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard Transport',
      icon: LayoutDashboard,
      roles: ['admin'], // Solo admin de transport
    },
    {
      path: '/logistics-dashboard',
      label: 'Dashboard Logística',
      icon: LayoutDashboard,
      roles: ['admin_logistics'], // Solo admin de logística
    },
    {
      path: '/equipment',
      label: 'Gestión de Equipos',
      icon: Truck,
      roles: ['admin', 'admin_logistics'], // Administradores de ambos departamentos
    },
    {
      path: '/operation-hours',
      label: 'Horas de Operación',
      icon: Clock,
      roles: ['admin', 'user'], // Operadores y admins
    },
    {
      path: '/overtime-tracking',
      label: 'Seguimiento H. Extras',
      icon: Calculator,
      roles: ['admin'], // Solo admin de transport
    },
    {
      path: '/fuel',
      label: 'Combustible',
      icon: Fuel,
      roles: ['admin', 'user'], // Operadores y admins
    },
    {
      path: '/operations',
      label: 'Operaciones',
      icon: Activity,
      roles: ['admin', 'user', 'guest'], // Admins, operadores e invitados
    },
    {
      path: '/checklist',
      label: 'Checklist Pre-Op',
      icon: ClipboardCheck,
      roles: ['admin', 'user'], // Operadores y admins
    },
    {
      path: '/transport-requests',
      label: 'Solicitudes Transporte',
      icon: FileText,
      roles: ['admin', 'admin_logistics', 'commercial'], // Admin, admin logística y comercial
    },
    {
      path: '/machines-management',
      label: 'Gestión de Máquinas',
      icon: Package,
      roles: ['admin', 'admin_logistics'], // Solo administradores
    },
    {
      path: '/manufacturer-kpg',
      label: 'KPG de Fábrica',
      icon: Fuel,
      roles: ['admin', 'admin_logistics'], // Solo administradores
    },
    {
      path: '/deliveries',
      label: 'Gestión de Entregas',
      icon: Package,
      roles: ['logistics', 'admin_logistics'], // Logística y su admin
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || '')
  );

  return (
    <aside className={`
      ${isCollapsed ? 'w-16' : 'w-64'} 
      bg-white shadow-md h-full border-r border-gray-200 flex flex-col overflow-y-auto
      transition-all duration-300 ease-in-out relative
    `}>
      {/* Botón para colapsar/expandir (solo en desktop) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-20 z-50 bg-white border border-gray-200 rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors items-center justify-center"
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          )}
        </button>
      )}

      <nav className="mt-6 px-4 flex-1">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3 sm:px-4'} py-2 sm:py-3 rounded-lg transition-colors duration-200 text-sm sm:text-base
                    ${
                      isActive
                        ? 'bg-primary-50 text-primary font-medium'
                        : 'text-secondary-700 hover:bg-secondary-100'
                    }
                  `}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Equipment info, user info and logout button */}
      <div className={`border-t border-gray-200 ${isCollapsed ? 'p-2' : 'p-4'} space-y-3`}>
        {/* Selected Equipment */}
        {selectedEquipment && !isCollapsed && (
          <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Truck className="h-4 w-4 text-primary mr-2" />
                <span className="text-xs font-medium text-primary-900">Equipo Actual</span>
              </div>
              <button
                onClick={handleChangeEquipment}
                className="text-primary hover:text-primary-700 p-1"
                title="Cambiar equipo"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            <p className="text-sm font-bold text-primary-900">
              {selectedEquipment.license_plate}
            </p>
            <p className="text-xs text-primary-700">
              {selectedEquipment.brand} - {selectedEquipment.vehicle_type === 'tractor' ? 'Tractor' : 'Trailer'}
            </p>
          </div>
        )}

        {/* User Info */}
        {!isCollapsed && (
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500 capitalize truncate">
                {user?.role}
              </p>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-center px-4'} py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200`}
          title={isCollapsed ? 'Cerrar Sesión' : undefined}
        >
          <LogOut className={`h-4 w-4 ${isCollapsed ? '' : 'mr-2'}`} />
          {!isCollapsed && 'Cerrar Sesión'}
        </button>
      </div>
    </aside>
  );
};
