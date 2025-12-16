import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { startSessionHeartbeat, stopSessionHeartbeat, refreshSessionIfNeeded } from '../services/sessionManager';
import { forceConnectionValidation } from '../services/connectionManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // DESACTIVADO: Lo manejamos manualmente con verificación de sesión
      refetchOnMount: true, // Refrescar al montar si los datos están stale
      refetchOnReconnect: true, // Refrescar cuando se reconecta la red
      retry: (failureCount, error: any) => {
        // No reintentar si es error de timeout o de sesión después de varios intentos
        if (error?.message?.includes('Timeout') || error?.message?.includes('sesión')) {
          return failureCount < 1;
        }
        // El interceptor maneja los errores de autenticación con auto-refresh
        // Permitir retry para otros errores, pero limitar a 2 reintentos
        return failureCount < 2;
      },
      staleTime: 2 * 60 * 1000, // Considerar datos stale después de 2 minutos
      gcTime: 5 * 60 * 1000, // Mantener en cache por 5 minutos
      structuralSharing: true,
      networkMode: 'online',
      // Timeout global para evitar que las queries se queden colgadas indefinidamente
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Timeout de 30 segundos para todas las queries
      meta: {
        timeout: 30000,
      },
    },
    mutations: {
      retry: (failureCount) => {
        // El interceptor maneja los errores de autenticación
        // Permitir 1 reintento para mutations
        return failureCount < 1;
      },
      networkMode: 'online',
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  useEffect(() => {
    // Iniciar heartbeat para mantener sesión activa
    startSessionHeartbeat();

    let hiddenTime: number | null = null;
    let lastInvalidationTime = 0;
    const MIN_HIDDEN_TIME = 30 * 1000; // Mínimo 30 segundos oculta para refrescar
    const INVALIDATION_COOLDOWN = 5 * 1000; // 5 segundos mínimo entre invalidaciones

    let lastUserActivity = Date.now();
    const INACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minutos de inactividad
    
    // Listener para detectar actividad del usuario (mouse, keyboard, touch)
    const handleUserActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastUserActivity;
      
      // Si el usuario estuvo inactivo por más de 10 minutos, invalidar queries
      if (timeSinceLastActivity > INACTIVITY_THRESHOLD && (now - lastInvalidationTime) > INVALIDATION_COOLDOWN) {
        console.log(`👆 Usuario activo después de ${Math.round(timeSinceLastActivity / 1000)}s de inactividad, refrescando datos...`);
        
        lastInvalidationTime = now;
        
        // Validar conexión y refrescar sesión
        forceConnectionValidation().catch(() => {});
        refreshSessionIfNeeded().catch(() => {});
        
        // Invalidar y refrescar queries activas
        setTimeout(() => {
          queryClient.invalidateQueries();
          queryClient.refetchQueries({ type: 'active' });
        }, 500);
      }
      
      lastUserActivity = now;
    };
    
    // Listener para detectar cuando la app vuelve a estar visible después de estar oculta
    const handleVisibilityChange = async () => {
      const now = Date.now();
      
      if (document.visibilityState === 'hidden') {
        // Marcar el tiempo cuando se oculta
        hiddenTime = now;
      } else if (document.visibilityState === 'visible') {
        // Si estaba oculta, calcular tiempo
        if (hiddenTime !== null) {
          const timeHidden = now - hiddenTime;
          
          // Solo refrescar si estuvo oculta por más de 30 segundos Y han pasado al menos 5 segundos desde la última invalidación
          if (timeHidden > MIN_HIDDEN_TIME && (now - lastInvalidationTime) > INVALIDATION_COOLDOWN) {
            console.log(`👁️ App visible después de ${Math.round(timeHidden / 1000)}s oculta, validando conexión y refrescando datos...`);
            
            lastInvalidationTime = now;
            
            // Intentar validar conexión en background (no bloqueante)
            forceConnectionValidation().catch(() => {
              // Ignorar errores de validación en background
            });
            
            // Refrescar sesión después de validar conexión
            refreshSessionIfNeeded().catch(() => {
              // Ignorar errores de refresh en background
            });
            
            // Refrescar queries activas después de un pequeño delay para dar tiempo al refresh de sesión
            setTimeout(() => {
              queryClient.refetchQueries({ 
                type: 'active',
                predicate: (query) => {
                  const dataAge = Date.now() - (query.state.dataUpdatedAt || 0);
                  return dataAge > MIN_HIDDEN_TIME;
                }
              });
            }, 500);
          }
          
          hiddenTime = null;
        } else {
          // Si no estaba oculta pero la app vuelve a estar visible, validar conexión y refrescar sesión
          forceConnectionValidation().catch(() => {
            // Ignorar errores
          });
          refreshSessionIfNeeded().catch(() => {
            // Ignorar errores
          });
        }
      }
    };

    // Listener para cambios de sesión de Supabase (solo eventos importantes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      // Solo loguear eventos importantes, no todos
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        console.log('🔐 Auth state changed:', event);
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Cuando se renueva el token o se inicia sesión, invalidar todas las queries
        // pero solo si han pasado al menos 5 segundos desde la última invalidación
        const now = Date.now();
        if ((now - lastInvalidationTime) > INVALIDATION_COOLDOWN) {
          console.log('🔄 Sesión renovada, invalidando y refrescando queries...');
          lastInvalidationTime = now;
          // Invalidar todas las queries y refrescar las activas
          queryClient.invalidateQueries();
          // Refrescar inmediatamente las queries activas después de un pequeño delay
          setTimeout(() => {
            queryClient.refetchQueries({ type: 'active' });
          }, 300);
        }
      } else if (event === 'SIGNED_OUT') {
        // Limpiar todas las queries cuando se cierra sesión
        console.log('🚪 Sesión cerrada, limpiando queries...');
        queryClient.cancelQueries();
        queryClient.clear();
        stopSessionHeartbeat();
      }
    });

    // Agregar listeners para detectar actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });
    
    // Solo agregar listener de visibilitychange (NO focus)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
      stopSessionHeartbeat();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
