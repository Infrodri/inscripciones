import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AsistenciaTab } from '../components/admin/event-tabs/AsistenciaTab';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('AsistenciaTab - QR de asistencia', () => {
  it('Caso A: selfCheckinOpen true -> existe el botón "Proyectar QR"', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url.startsWith('/sessions/event/')) {
        return {
          data: {
            data: [
              {
                id: 's1',
                startsAt: new Date().toISOString(),
                endsAt: null,
                location: 'Sala A',
                label: 'Sesión Principal',
                selfCheckinOpen: true,
              },
            ],
          },
        };
      }
      if (url.endsWith('/stats')) {
        return { data: { participants: 10 } };
      }
      if (url.startsWith('/events/')) {
        return { data: { checkinWindowMinutes: 60 } };
      }
      if (url.includes('/attendances')) {
        return { data: { data: [] } };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={createClient()}>
        <AsistenciaTab eventId="ev-1" />
      </QueryClientProvider>
    );

    const boton = await screen.findByRole('button', { name: 'Proyectar QR' });
    expect(boton).toBeTruthy();
  });

  it('Caso B: selfCheckinOpen false -> existe "El registro por QR está cerrado." y NO existe el botón', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url.startsWith('/sessions/event/')) {
        return {
          data: {
            data: [
              {
                id: 's2',
                startsAt: new Date().toISOString(),
                endsAt: null,
                location: 'Sala B',
                label: 'Sesión Secundaria',
                selfCheckinOpen: false,
              },
            ],
          },
        };
      }
      if (url.endsWith('/stats')) {
        return { data: { participants: 10 } };
      }
      if (url.startsWith('/events/')) {
        return { data: { checkinWindowMinutes: 60 } };
      }
      if (url.includes('/attendances')) {
        return { data: { data: [] } };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={createClient()}>
        <AsistenciaTab eventId="ev-2" />
      </QueryClientProvider>
    );

    const mensaje = await screen.findByText('El registro por QR está cerrado.');
    expect(mensaje).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Proyectar QR' })).toBeNull();
  });
});
