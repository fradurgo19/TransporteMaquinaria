import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../atoms/Button';

interface NavbarProps {
  onMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="mr-4 text-gray-600 hover:text-gray-900 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
              <img 
                src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
                alt="Partequipos S.A.S" 
                className="h-8 w-auto sm:h-10 object-contain"
                style={{ maxHeight: '40px' }}
              />
              <span className="hidden sm:block text-base sm:text-lg font-semibold" style={{ color: '#50504f' }}>
                Gestión de Transporte Partequipos
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {user && (
              <>
                <div className="hidden sm:block text-sm">
                  <p className="font-medium text-gray-900 truncate max-w-[100px]">{user.username}</p>
                  <p className="text-gray-500 capitalize text-xs">{user.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs sm:text-sm"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
