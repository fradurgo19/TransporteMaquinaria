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
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEquipment } from '../context/EquipmentContext';

export const Sidebar: React.FC = () => {
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
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin'], // Solo administradores
    },
    {
      path: '/equipment',
      label: 'Gestión de Equipos',
      icon: Truck,
      roles: ['admin'], // Solo administradores
    },
    {
      path: '/operation-hours',
      label: 'Horas de Operación',
      icon: Clock,
      roles: ['admin', 'user'], // Operadores y admins
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
      roles: ['admin', 'commercial'], // Solo admin y comercial
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || '')
  );

  return (
    <aside className="w-64 bg-white shadow-md h-full border-r border-gray-200 flex flex-col">
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
                    flex items-center px-4 py-3 rounded-lg transition-colors duration-200
                    ${
                      isActive
                        ? 'bg-primary-50 text-primary font-medium'
                        : 'text-secondary-700 hover:bg-secondary-100'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Equipment info, user info and logout button */}
      <div className="border-t border-gray-200 p-4 space-y-3">
        {/* Selected Equipment */}
        {selectedEquipment && (
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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};
