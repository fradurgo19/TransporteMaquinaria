import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '../atoms/Button';
import { useAuth } from '../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const goToDashboard = () => {
    switch (user?.role) {
      case 'admin':
        navigate('/dashboard', { replace: true });
        break;
      case 'admin_logistics':
        navigate('/logistics-dashboard', { replace: true });
        break;
      case 'logistics':
        navigate('/deliveries', { replace: true });
        break;
      case 'commercial':
        navigate('/transport-requests', { replace: true });
        break;
      case 'guest':
        navigate('/operations', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-4 rounded-full">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don&apos;t have permission to access this page.
          </p>
          <Button onClick={goToDashboard} fullWidth>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
