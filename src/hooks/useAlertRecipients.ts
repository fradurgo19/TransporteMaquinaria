import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

export interface AlertRecipient {
  id: string;
  department: 'transport' | 'logistics';
  email: string;
  created_at: string;
}

/** Verifica si el error indica que la tabla alert_email_recipients no existe. */
export function isAlertRecipientsTableMissingError(e: unknown): boolean {
  const msg = (e && typeof e === 'object' && 'message' in e)
    ? String((e as { message?: string }).message)
    : '';
  const code = (e && typeof e === 'object' && 'code' in e)
    ? String((e as { code?: string }).code)
    : '';
  const status = (e && typeof e === 'object' && 'status' in e)
    ? Number((e as { status?: number }).status)
    : 0;
  return (
    /alert_email_recipients|schema cache|Could not find the table|relation.*does not exist|42P01/i.test(msg) ||
    code === '42P01' ||
    status === 404
  );
}

export function useAlertRecipients() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['alert_email_recipients'],
    queryFn: async () => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('alert_email_recipients')
          .select('*')
          .order('department')
          .order('email')
      );
      if (result.error) throw result.error;
      return (result.data || []) as AlertRecipient[];
    },
    retry: (failureCount, error) => {
      if (isAlertRecipientsTableMissingError(error)) return false;
      return failureCount < 2;
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ department, email }: { department: 'transport' | 'logistics'; email: string }) => {
      const result = await executeSupabaseQuery(async () =>
        await supabase
          .from('alert_email_recipients')
          .insert({ department, email: email.trim().toLowerCase() })
          .select()
          .single()
      );
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data');
      return result.data as AlertRecipient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert_email_recipients'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await executeSupabaseQuery(async () =>
        await supabase.from('alert_email_recipients').delete().eq('id', id)
      );
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert_email_recipients'] });
    },
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    add: addMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
