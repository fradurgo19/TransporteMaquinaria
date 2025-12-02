import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para subscripciones en tiempo real de Supabase
 * Invalida automáticamente el caché de React Query cuando hay cambios en la BD
 */
export const useRealtimeSubscription = (
  table: string,
  queryKey: string[]
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log(`🔄 Subscripción en tiempo real activada para ${table}`);

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`📡 Cambio detectado en ${table}:`, payload);
          
          // Invalidar caché para refrescar automáticamente
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      console.log(`❌ Desuscribiendo de ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, queryKey, queryClient]);
};

