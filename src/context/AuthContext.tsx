import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { AuthContextType, User, UserRole } from '../types';

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
  const isMountedRef = React.useRef(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      if (!isMountedRef.current) return;

      console.log('🔍 Fetching user profile for ID:', userId);

      // Agregar timeout a la consulta
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La consulta tardó más de 10 segundos')), 10000);
      });

      // Usar el cliente de Supabase que incluye automáticamente el token de autenticación
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const result = await Promise.race([queryPromise, timeoutPromise]) as { data: any; error: any };

      if (!isMountedRef.current) return;

      const { data, error } = result;

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        
        // Si es un error de permisos, intentar obtener el usuario desde auth.users
        if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
          console.warn('⚠️ Error de permisos RLS, intentando obtener datos básicos del usuario...');
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            console.log('✅ Usando datos de auth.users como fallback');
            setUser({
              id: authUser.id,
              username: authUser.email?.split('@')[0] || 'user',
              email: authUser.email || '',
              role: 'user' as UserRole, // Rol por defecto
              full_name: authUser.user_metadata?.full_name || '',
              phone: authUser.user_metadata?.phone || '',
              createdAt: authUser.created_at || new Date().toISOString(),
            });
            return;
          }
        }
        
        setUser(null);
        return;
      }

      if (data) {
        console.log('✅ User profile fetched:', data);
        setUser({
          id: data.id,
          username: data.username,
          email: data.email,
          role: data.role as UserRole,
          full_name: data.full_name,
          phone: data.phone,
          createdAt: data.created_at,
        });
      } else {
        console.warn('⚠️ No user data returned');
        setUser(null);
      }
    } catch (error: any) {
      console.error('❌ Exception in fetchUserProfile:', error);
      if (error.message?.includes('Timeout')) {
        console.error('⏱️ La consulta se quedó colgada. Probable problema con políticas RLS.');
      }
      if (isMountedRef.current) {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    const initAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        
        // Obtener sesión persistida
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Error getting session:', sessionError);
          if (isMountedRef.current) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }
        
        if (!isMountedRef.current) return;
        
        if (session?.user) {
          console.log('✅ Session found, user:', session.user.email);
          console.log('🔄 Restoring user profile...');
          
          // Intentar obtener el perfil, pero si falla, usar datos básicos de auth
          try {
            await fetchUserProfile(session.user.id);
          } catch (error) {
            console.warn('⚠️ Error fetching profile, using auth data as fallback:', error);
            // Si falla, usar datos básicos de la sesión
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser && isMountedRef.current) {
              setUser({
                id: authUser.id,
                username: authUser.email?.split('@')[0] || 'user',
                email: authUser.email || '',
                role: 'user' as UserRole,
                full_name: authUser.user_metadata?.full_name || '',
                phone: authUser.user_metadata?.phone || '',
                createdAt: authUser.created_at || new Date().toISOString(),
              });
            }
          }
        } else {
          console.log('ℹ️ No active session found');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Error in auth initialization:', error);
        if (isMountedRef.current) {
          setUser(null);
        }
      } finally {
        if (isMountedRef.current) {
          console.log('✅ Auth initialization complete');
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Escuchar cambios en el estado de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        if (!isMountedRef.current) return;
        
        // Manejar diferentes eventos
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('👤 User signed in/refreshed, fetching profile...');
            await fetchUserProfile(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out, clearing user');
          setUser(null);
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            console.log('👤 User updated, refreshing profile...');
            await fetchUserProfile(session.user.id);
          }
        }
        
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', email);
      
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
        
        await fetchUserProfile(data.user.id);
        
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
      }
    } catch (error) {
      console.error('❌ Login exception:', error);
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
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
