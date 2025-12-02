import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { User, UserRole } from '../types';

/**
 * Hook optimizado para obtener el perfil del usuario
 * Usa React Query para caché automático y evitar timeouts
 */
export const useUserProfile = (userId: string | null) => {
  return useQuery({
    queryKey: ['user_profile', userId],
    queryFn: async (): Promise<User | null> => {
      if (!userId) return null;

      try {
        // Primero intentar desde la tabla users con timeout corto
        const { data, error } = await Promise.race([
          supabase
            .from('users')
            .select('id, username, email, role, full_name, phone, created_at')
            .eq('id', userId)
            .single(),
          new Promise<{ data: null; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1500)
          ),
        ]);

        if (error) throw error;

        if (data) {
          return {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role as UserRole,
            full_name: data.full_name,
            phone: data.phone,
            createdAt: data.created_at,
          };
        }
      } catch (err: any) {
        // Si falla o hay timeout, usar auth.users como fallback
        console.warn('⚠️ Usando fallback de auth.users:', err.message);
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          return {
            id: authUser.id,
            username: authUser.email?.split('@')[0] || 'user',
            email: authUser.email || '',
            role: (authUser.user_metadata?.role || 'user') as UserRole,
            full_name: authUser.user_metadata?.full_name || '',
            phone: authUser.user_metadata?.phone || '',
            createdAt: authUser.created_at || new Date().toISOString(),
          };
        }
      }

      return null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutos - perfil cambia poco
    gcTime: 30 * 60 * 1000, // 30 minutos
    retry: 1,
    retryDelay: 500,
  });
};

