import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { AuthContextType, User, UserRole } from '../types';

// Toggle de logs de depuración para auth (mantener en false en producción)
const DEBUG_AUTH = false;
const debugLog = DEBUG_AUTH ? console.log : (..._args: any[]) => {};
const debugWarn = DEBUG_AUTH ? console.warn : (..._args: any[]) => {};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false); // Rastrear si hay sesión activa en Supabase
  const isMountedRef = React.useRef(true);
  const fetchingProfileRef = React.useRef(false); // Evitar múltiples llamadas simultáneas
  const lastFetchTimeRef = React.useRef<number>(0); // Cache temporal
  const userSetRef = React.useRef(false); // Rastrear si el usuario se estableció
  const initInProgressRef = React.useRef(false); // Rastrear si la inicialización está en progreso

  const fetchUserProfile = async (userId: string, forceRefresh = false) => {
    try {
      if (!isMountedRef.current) return;

      // Evitar múltiples llamadas simultáneas
      if (fetchingProfileRef.current && !forceRefresh) {
        debugLog('⏸️ Profile fetch already in progress, skipping...');
        return;
      }

      // Cache temporal: no hacer fetch si se hizo hace menos de 5 segundos (excepto si es forzado)
      const now = Date.now();
      if (!forceRefresh && now - lastFetchTimeRef.current < 5000 && user?.id === userId) {
        debugLog('💾 Using cached user profile');
        return;
      }

      fetchingProfileRef.current = true;
      lastFetchTimeRef.current = now;

      debugLog('🔍 Fetching user profile for ID:', userId);

      // SOLUCIÓN: Usar SOLO auth.users directamente (sin tabla users que da timeout)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        console.error('❌ Error getting auth user:', authError);
        fetchingProfileRef.current = false;
        if (!user) setUser(null);
        return;
      }

      // Intentar obtener role de la tabla users con timeout muy corto (500ms)
      let userRole: string | null = null;
      try {
        const { data: userData } = await Promise.race([
          supabase.from('users').select('role').eq('id', userId).single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
        ]) as any;
        
        if (userData?.role) {
          userRole = userData.role;
        }
      } catch {
        // Si falla o timeout, usar role de metadata o 'user' por defecto
        userRole = authUser.user_metadata?.role || 'user';
      }

      const result = { data: authUser, error: null };

      if (!isMountedRef.current) {
        fetchingProfileRef.current = false;
        return;
      }

      const { data } = result;

      if (data && isMountedRef.current) {
        debugLog('✅ User profile fetched from auth.users');
        const userData: User = {
          id: data.id,
          username: data.email?.split('@')[0] || 'user',
          email: data.email || '',
          role: (userRole || data.user_metadata?.role || 'user') as UserRole,
          full_name: data.user_metadata?.full_name || '',
          phone: data.user_metadata?.phone || '',
          createdAt: data.created_at || new Date().toISOString(),
        };
        setUser(userData);
        userSetRef.current = true;
      } else {
        debugWarn('⚠️ No user data returned');
        if (!user) {
          setUser(null);
          userSetRef.current = false;
        }
      }
      
      fetchingProfileRef.current = false;
    } catch (error: any) {
      console.error('❌ Exception in fetchUserProfile:', error);
      fetchingProfileRef.current = false;
      
      if (error.message?.includes('Timeout')) {
        debugWarn('⏱️ Query timeout, usando fallback directo (mantener usuario actual)');
        fetchingProfileRef.current = false;
        
        // Si ya tenemos usuario en cache, mantenerlo
        if (user && user.id === userId) {
          debugLog('✅ Manteniendo usuario en cache');
          return;
        }
        
        // Si no, obtener desde auth
        try {
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          
          if (authError) {
            console.error('❌ Error getting auth user:', authError);
            return;
          }
          
          if (authUser && isMountedRef.current) {
            debugLog('✅ Using auth user as fallback');
            debugLog('📋 Auth user data:', {
              id: authUser.id,
              email: authUser.email,
              metadata: authUser.user_metadata
            });
            
            // Usar datos de auth.users directamente sin consultar public.users
            // Esto evita timeouts adicionales
            const fallbackUser: User = {
              id: authUser.id,
              username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
              email: authUser.email || '',
              role: (authUser.user_metadata?.role as UserRole) || 'user',
              full_name: authUser.user_metadata?.full_name || '',
              phone: authUser.user_metadata?.phone || '',
              createdAt: authUser.created_at || new Date().toISOString(),
            };
            
            debugLog('✅ Fallback user created (from auth metadata):', fallbackUser);
            debugLog('🔄 Setting user state...');
            
            if (isMountedRef.current) {
              setUser(fallbackUser);
              userSetRef.current = true;
              debugLog('✅ User state set successfully, userSetRef:', userSetRef.current);
            } else {
              debugWarn('⚠️ Component unmounted, cannot set user');
            }
            
            // Intentar actualizar el perfil en background (sin bloquear)
            // Esto se hace de forma asíncrona y no afecta el login
            setTimeout(async () => {
              try {
                const { data: userData } = await supabase
                  .from('users')
                  .select('role, username, full_name, phone')
                  .eq('id', authUser.id)
                  .maybeSingle();
                
                if (userData && isMountedRef.current) {
                  debugLog('✅ Background profile update successful');
                  setUser({
                    ...fallbackUser,
                    username: userData.username || fallbackUser.username,
                    role: (userData.role as UserRole) || fallbackUser.role,
                    full_name: userData.full_name || fallbackUser.full_name,
                    phone: userData.phone || fallbackUser.phone,
                  });
                }
              } catch (bgError) {
                debugWarn('⚠️ Background profile update failed (non-critical):', bgError);
              }
            }, 1000);
          } else if (!user && isMountedRef.current) {
            debugWarn('⚠️ No auth user available, clearing session');
            setUser(null);
          }
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          // Si no hay usuario en cache y fallback falla, cerrar sesión
          if (!user && isMountedRef.current) {
            debugWarn('⚠️ All fallbacks failed, clearing session');
            setUser(null);
          }
        }
      } else {
        // Para otros errores, mantener usuario si existe
        if (!user && isMountedRef.current) {
          debugWarn('⚠️ Error and no cached user, clearing session');
          setUser(null);
        }
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    initInProgressRef.current = true; // Flag para evitar que onAuthStateChange interfiera

    const initAuth = async () => {
      try {
        debugLog('🔄 Initializing auth...');
        
        // Verificar localStorage para debugging
        const storedSession = localStorage.getItem('sb-auth-token');
        debugLog('💾 Stored session in localStorage:', storedSession ? 'exists' : 'not found');
        
        // Obtener sesión persistida
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Error getting session:', sessionError);
          if (isMountedRef.current) {
            setUser(null);
            setIsLoading(false);
            initInProgressRef.current = false;
          }
          return;
        }
        
        if (!isMountedRef.current) return;
        
        if (session?.user) {
          debugLog('✅ Session found, user:', session.user.email);
          debugLog('🔑 Session expires at:', new Date(session.expires_at! * 1000).toISOString());
          debugLog('🔄 Restoring user profile...');
          
          // Marcar que hay una sesión activa
          if (isMountedRef.current) {
            setHasActiveSession(true);
          }
          
          userSetRef.current = false; // Reset flag
          
          // Intentar obtener el perfil con timeout más agresivo
          let profileCompleted = false;
          let timeoutReached = false;
          
          const profilePromise = fetchUserProfile(session.user.id).then(() => {
            if (!timeoutReached) {
              profileCompleted = true;
            }
          }).catch(() => {
            if (!timeoutReached) {
              profileCompleted = true;
            }
          });
          
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              if (!userSetRef.current) {
                timeoutReached = true;
                debugWarn('⏱️ Profile fetch timeout in init (3s), using immediate fallback');
                resolve('timeout');
              }
            }, 3000); // 3 segundos máximo
          });
          
          try {
            await Promise.race([profilePromise, timeoutPromise]);
          } catch (error) {
            debugWarn('⚠️ Error fetching profile in init:', error);
          }
          
          // Si el timeout se alcanzó, forzar el fallback
          if (timeoutReached && !userSetRef.current) {
            debugLog('⏱️ Timeout reached, forcing fallback...');
          }
          
          // Si después del fetch no se estableció el usuario, usar fallback inmediato
          if (!userSetRef.current && isMountedRef.current) {
            debugLog('🔄 No user set after fetch, using immediate auth fallback...');
            try {
              const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
              if (authUser && !authError && isMountedRef.current) {
                const fallbackUser: User = {
                  id: authUser.id,
                  username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
                  email: authUser.email || '',
                  role: (authUser.user_metadata?.role as UserRole) || 'user',
                  full_name: authUser.user_metadata?.full_name || '',
                  phone: authUser.user_metadata?.phone || '',
                  createdAt: authUser.created_at || new Date().toISOString(),
                };
                debugLog('✅ Fallback user set from auth in init:', fallbackUser);
                setUser(fallbackUser);
                userSetRef.current = true;
              } else if (isMountedRef.current) {
                debugWarn('⚠️ Could not get auth user for fallback');
                setUser(null);
                userSetRef.current = false;
              }
            } catch (fallbackErr) {
              console.error('❌ Error in fallback:', fallbackErr);
              // Si todo falla, al menos establecer isLoading a false
              if (isMountedRef.current) {
                setUser(null);
                userSetRef.current = false;
              }
            }
          }
          
          // Marcar inicialización como completa
          if (isMountedRef.current) {
            debugLog('✅ Auth initialization complete, user set:', userSetRef.current);
            initInProgressRef.current = false;
            // Esperar un tick para que React procese setUser antes de establecer isLoading
            // Esto asegura que el estado esté sincronizado
            await new Promise(resolve => setTimeout(resolve, 50));
            if (isMountedRef.current && userSetRef.current) {
              debugLog('✅ Setting isLoading to false after user is set');
              setIsLoading(false);
            } else if (isMountedRef.current) {
              debugWarn('⚠️ User not set after timeout, but session exists. Setting isLoading to false anyway.');
              setIsLoading(false);
            }
          }
        } else {
          debugLog('ℹ️ No active session found');
          setUser(null);
          setHasActiveSession(false);
          userSetRef.current = false;
          if (isMountedRef.current) {
            setIsLoading(false);
            initInProgressRef.current = false;
          }
        }
      } catch (error) {
        console.error('❌ Error in auth initialization:', error);
        if (isMountedRef.current) {
          setUser(null);
          userSetRef.current = false;
          setIsLoading(false);
          initInProgressRef.current = false;
        }
      }
    };

    initAuth();

    // Escuchar cambios en el estado de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('🔄 Auth state changed:', event, session?.user?.email);
        
        if (!isMountedRef.current) return;
        
        // Ignorar eventos durante la inicialización excepto SIGNED_IN y SIGNED_OUT
        // Permitimos SIGNED_IN para que el login no quede bloqueado si init sigue corriendo
        if (initInProgressRef.current && event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') {
          debugLog('⏸️ Initialization in progress, skipping', event, 'event');
          return;
        }
        
        // Manejar diferentes eventos
        if (event === 'SIGNED_IN') {
          if (session?.user) {
            // Establecer usuario inmediato desde auth para no bloquear la UI
            const immediateUser: User = {
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
              email: session.user.email || '',
              role: (session.user.user_metadata?.role as UserRole) || 'user',
              full_name: session.user.user_metadata?.full_name || '',
              phone: session.user.user_metadata?.phone || '',
              createdAt: session.user.created_at || new Date().toISOString(),
            };
            setUser(immediateUser);
            userSetRef.current = true;
            setHasActiveSession(true);
            initInProgressRef.current = false;
            setIsLoading(false);

            // Fetch de perfil en background para refinar role si la tabla users responde
            if (!fetchingProfileRef.current) {
              console.log('👤 User signed in, fetching profile (background)...');
              fetchUserProfile(session.user.id, true).catch((err) => {
                console.warn('⚠️ Background profile fetch failed:', err?.message || err);
              });
            } else {
              console.log('👤 User already loading profile - skipping duplicate fetch');
            }
          }
        } else if (event === 'INITIAL_SESSION') {
          // No hacer nada en INITIAL_SESSION, initAuth ya lo maneja
          console.log('🔄 Initial session event, handled by initAuth - skipping');
          return; // No establecer isLoading aquí
        } else if (event === 'TOKEN_REFRESHED') {
          // No hacer fetch en refresh de token para evitar timeouts
          // El token se refresca automáticamente, no necesitamos recargar el perfil
          console.log('🔄 Token refreshed, maintaining current session');
          // No hacer nada, mantener el usuario actual
          return; // No establecer isLoading aquí
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out, clearing user');
          setUser(null);
          setHasActiveSession(false);
          userSetRef.current = false;
          fetchingProfileRef.current = false;
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        } else if (event === 'USER_UPDATED') {
          // No refrescar perfil en cada update para evitar timeouts
          // El usuario se actualiza solo cuando hace login o manualmente
          console.log('👤 User updated event, manteniendo usuario actual en cache');
          return;
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Sincronizar isLoading con el estado del usuario
  // Esto asegura que isLoading solo sea false cuando el usuario esté realmente establecido
  useEffect(() => {
    // Solo sincronizar si la inicialización ya terminó
    if (initInProgressRef.current) {
      return; // Aún estamos inicializando, no hacer nada
    }
    
    // Timeout de seguridad: si después de 10 segundos aún estamos cargando, forzar resolución
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('⏱️ Timeout de carga de autenticación, forzando resolución...');
        setIsLoading(false);
      }
    }, 10000); // 10 segundos máximo

    // Si tenemos un usuario y aún estamos cargando, dejar de cargar
    if (user && isLoading) {
      console.log('✅ User state synchronized, setting isLoading to false');
      setIsLoading(false);
    }
    // Si no hay usuario y la inicialización terminó, también dejar de cargar
    else if (!user && isLoading && !fetchingProfileRef.current && !initInProgressRef.current) {
      console.log('✅ No user after init, setting isLoading to false');
      setIsLoading(false);
    }

    return () => clearTimeout(timeoutId);
  }, [user, isLoading]);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', email);
      // Limpiar cualquier sesión atascada antes de intentar login
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignorar error de signOut
      }
      userSetRef.current = false;
      fetchingProfileRef.current = false;
      initInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(true);
        setUser(null);
        setHasActiveSession(false);
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        throw error;
      }

      if (data.user) {
        console.log('✅ Login successful, user ID:', data.user.id);
        console.log('📧 User email:', data.user.email);
        
        // Marcar que hay una sesión activa
        if (isMountedRef.current) {
          setHasActiveSession(true);
          // Asegurar que no bloqueemos eventos SIGNED_IN posteriores
          initInProgressRef.current = false;
        }
        
        // El onAuthStateChange manejará el fetch del perfil
        // Solo esperamos un momento para que se complete
        // No hacer fetch aquí para evitar duplicados
        console.log('✅ Login successful, waiting for auth state change to load profile...');
        
        // Dar tiempo para que onAuthStateChange se ejecute
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Si después de esperar no tenemos usuario, usar fallback
        if (!userSetRef.current && isMountedRef.current) {
          console.log('🔄 No user set after auth state change, using immediate fallback...');
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          if (authUser && !authError && isMountedRef.current) {
            const fallbackUser: User = {
              id: authUser.id,
              username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
              email: authUser.email || '',
              role: (authUser.user_metadata?.role as UserRole) || 'user',
              full_name: authUser.user_metadata?.full_name || '',
              phone: authUser.user_metadata?.phone || '',
              createdAt: authUser.created_at || new Date().toISOString(),
            };
            console.log('✅ Fallback user set in login:', fallbackUser);
            setUser(fallbackUser);
            userSetRef.current = true;
          }
        }
        
        // Asegurar que isLoading se actualice
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        
        // Solicitar permiso de ubicación después del login (no bloquea el flujo)
        // Esto se hace de forma asíncrona y no afecta el login
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('📍 Ubicación obtenida:', position.coords.latitude, position.coords.longitude);
              localStorage.setItem('geoPermissionGranted', 'true');
            },
            (error) => {
              // No es crítico si se deniega, solo registramos el warning
              console.warn('⚠️ Permiso de ubicación denegado:', error.message);
              localStorage.setItem('geoPermissionGranted', 'false');
            },
            {
              timeout: 5000,
              enableHighAccuracy: false
            }
          );
        }
      } else {
        console.warn('⚠️ Login successful but no user data');
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('❌ Login exception:', error);
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      throw error;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    role: UserRole = 'user'
  ) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          username,
          email,
          role,
        });

        if (profileError) throw profileError;

        await fetchUserProfile(authData.user.id);
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Iniciando logout...');
      
      // Cancelar todas las queries pendientes primero
      // Esto se hace importando queryClient desde QueryProvider
      try {
        // Usar import dinámico para evitar dependencias circulares
        const queryProviderModule = await import('../context/QueryProvider');
        const queryClient = (queryProviderModule as any).queryClient;
        if (queryClient) {
          queryClient.cancelQueries();
          queryClient.clear();
          console.log('✅ Queries canceladas y cache limpiado');
        }
      } catch (importError) {
        console.warn('⚠️ No se pudo cancelar queries (no crítico):', importError);
      }

      // Limpiar estado local PRIMERO (no depende de la conexión)
      setUser(null);
      setHasActiveSession(false);
      userSetRef.current = false;
      fetchingProfileRef.current = false;
      
      // Limpiar localStorage de sesión
      try {
        localStorage.removeItem('sb-auth-token');
        localStorage.removeItem('selectedEquipment');
      } catch (storageError) {
        console.warn('⚠️ Error limpiando localStorage (no crítico):', storageError);
      }

      // Intentar cerrar sesión en Supabase con timeout corto
      // Si falla o timeout, no es crítico porque ya limpiamos el estado local
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Logout timeout')), 3000)
          )
        ]);
        console.log('✅ Logout en Supabase completado');
      } catch (error: any) {
        // Si falla el logout en Supabase, no es crítico porque ya limpiamos el estado local
        console.warn('⚠️ Error al cerrar sesión en Supabase (no crítico, estado local ya limpiado):', error?.message);
      }
      
      console.log('✅ Logout completado exitosamente');
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      
      // Aún así, limpiar el estado local aunque falle el signOut
      setUser(null);
      setHasActiveSession(false);
      userSetRef.current = false;
      fetchingProfileRef.current = false;
      
      // Limpiar localStorage de sesión
      try {
        localStorage.removeItem('sb-auth-token');
        localStorage.removeItem('selectedEquipment');
      } catch (storageError) {
        console.warn('⚠️ Error limpiando localStorage (no crítico):', storageError);
      }
      
      // No lanzar error - el logout siempre debe completarse limpiando el estado local
      console.warn('⚠️ Logout completado (estado local limpiado, aunque hubo error en Supabase)');
    }
  };

  // isAuthenticated debe considerar tanto el usuario como la sesión activa
  // Esto previene redirecciones prematuras al login durante la carga inicial
  const isAuthenticated = !!user || (hasActiveSession && isLoading);
  
  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
