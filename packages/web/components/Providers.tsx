'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto de datos frescos (evita refetch redundante al navegar entre tabs)
            gcTime: 5 * 60 * 1000, // 5 minutos en caché de memoria para navegación instantánea
            refetchOnWindowFocus: false, // Evita ráfagas de peticiones al volver a la pestaña
            retry: 1, // Evita cascadas de reintentos
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
