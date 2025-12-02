import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Cambiar a true para refrescar al montar
      refetchOnReconnect: true, // Refrescar al reconectar
      retry: 1,
      staleTime: 1 * 60 * 1000, // Reducir a 1 minuto
      gcTime: 5 * 60 * 1000, // Reducir a 5 minutos
      structuralSharing: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
