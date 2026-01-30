import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

// Retraso antes de redirigir a unauthorized: evita que al cambiar de módulo el rol aún no esté disponible y redirija por error (p. ej. usuarios de logística)
const UNAUTHORIZED_DELAY_MS = 1500;

export const useProtectedRoute = (allowedRoles?: UserRole[]) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const mountedAt = useRef<number | null>(null);
  const userRef = useRef(user);
  const allowedRolesRef = useRef(allowedRoles);
  const hadRoleRef = useRef(!!user?.role);
  userRef.current = user;
  allowedRolesRef.current = allowedRoles;
  const hasRole = !!user?.role;
  if (hadRoleRef.current !== hasRole && hasRole) {
    hadRoleRef.current = true;
    mountedAt.current = Date.now();
  } else if (mountedAt.current === null) {
    mountedAt.current = Date.now();
  }
  if (!hasRole) hadRoleRef.current = false;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (!allowedRoles?.length) return;
    if (user?.role == null) return;
    if (allowedRoles.includes(user.role)) return;

    const elapsed = Date.now() - (mountedAt.current ?? Date.now());
    if (elapsed < UNAUTHORIZED_DELAY_MS) {
      const t = setTimeout(() => {
        const currentUser = userRef.current;
        const currentRoles = allowedRolesRef.current;
        if (!currentRoles?.length || currentUser?.role == null) return;
        if (currentRoles.includes(currentUser.role)) return;
        navigate('/unauthorized', { replace: true });
      }, UNAUTHORIZED_DELAY_MS - elapsed);
      return () => clearTimeout(t);
    }
    navigate('/unauthorized', { replace: true });
  }, [isAuthenticated, user, isLoading, allowedRoles, navigate]);

  return { isLoading, user };
};
