import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: 'always', // Siempre refrescar al montar
      refetchOnReconnect: false,
      retry: 2,
      staleTime: 0, // Siempre considerar datos como stale
      gcTime: 5 * 60 * 1000,
      structuralSharing: true,
      networkMode: 'online', // Solo hacer queries cuando hay conexión
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
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
