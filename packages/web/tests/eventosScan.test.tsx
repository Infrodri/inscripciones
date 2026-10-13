import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import EventosPage from '../app/admin/eventos/page';
import EscanerPage from '../app/admin/escaner/page';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: { get: vi.fn(), post: vi.fn() } };
});

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Bloque 5', () => {
  it('eventos en tarjetas con estado, inscritos y acciones', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return { data: { data: [{ id: 'e1', slug: 'ev', title: 'Ev', status: 'ABIERTO' }] } };
      }
      if (url.startsWith('/sessions/event/')) {
        return { data: { data: [{ id: 's1', startsAt: new Date().toISOString() }] } };
      }
      return { data: { participants: 5 } };
    });
    render(
      <QueryClientProvider client={client()}>
        <EventosPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Ev')).toBeDefined();
    expect(screen.getByText('ABIERTO')).toBeDefined();
    expect(screen.getByText(/Inscritos:/)).toBeDefined();
    expect(screen.getByText('Abrir').getAttribute('href')).toBe('/admin/eventos/e1');
    expect(screen.getByText('Duplicar')).toBeDefined();
  });

  it('escáner marca la sesión activa en verde', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: { data: [{ id: 'e1', title: 'Ev', status: 'ABIERTO', checkinWindowMinutes: 60 }] },
        };
      }
      return {
        data: {
          data: [{ id: 's1', startsAt: new Date().toISOString(), endsAt: null, label: 'S1' }],
        },
      };
    });
    render(
      <QueryClientProvider client={client()}>
        <EscanerPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Activa ahora')).toBeDefined();
    expect(screen.getByText('Abrir escáner').getAttribute('href')).toBe('/scan/s1');
  });
});
