import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const useProtectedRoute = (allowedRoles?: UserRole[]) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        navigate('/unauthorized', { replace: true });
      }
    }
  }, [isAuthenticated, user, isLoading, allowedRoles, navigate]);

  return { isLoading, user };
};
