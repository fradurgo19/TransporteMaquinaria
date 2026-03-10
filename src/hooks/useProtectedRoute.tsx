import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

// Retraso antes de redirigir a unauthorized: evita que al cambiar de módulo el rol aún no esté disponible
const UNAUTHORIZED_DELAY_MS = 1500;
// Tiempo extra cuando el rol es 'user' y la ruta es de admin: el perfil puede estar cargando (recarga/pestaña)
const PROFILE_LOADING_GRACE_MS = 4500;

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
  }
  mountedAt.current ??= Date.now();
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

    const isAdminOnlyRoute = allowedRoles.some((r) => r === 'admin' || r === 'admin_logistics');
    const roleMightBeStale = isAuthenticated && user.role === 'user' && isAdminOnlyRoute;
    const delayMs = roleMightBeStale ? PROFILE_LOADING_GRACE_MS : UNAUTHORIZED_DELAY_MS;

    const elapsed = Date.now() - (mountedAt.current ?? Date.now());
    if (elapsed < delayMs) {
      const t = setTimeout(() => {
        const currentUser = userRef.current;
        const currentRoles = allowedRolesRef.current;
        if (!currentRoles?.length || currentUser?.role == null) return;
        if (currentRoles.includes(currentUser.role)) return;
        navigate('/unauthorized', { replace: true });
      }, delayMs - elapsed);
      return () => clearTimeout(t);
    }
    navigate('/unauthorized', { replace: true });
  }, [isAuthenticated, user, isLoading, allowedRoles, navigate]);

  return { isLoading, user };
};
