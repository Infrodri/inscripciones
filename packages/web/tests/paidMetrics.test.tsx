import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import EventosPage from '../app/admin/eventos/page';
import { ResumenTab } from '../components/admin/event-tabs/ResumenTab';
import { ParticipantsTable } from '../components/admin/ParticipantsTable';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: { get: vi.fn(), post: vi.fn() },
    getSessionUser: () => ({ id: 'u1', role: 'ADMIN', name: 'Admin' }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/eventos',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Paid Event Metrics & Monto Recaudado', () => {
  it('EventosPage displays cost badge and total collected revenue for paid events', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [
              {
                id: 'e-paid',
                slug: 'congreso-pago',
                title: 'Congreso de Medicina',
                status: 'ABIERTO',
                isFree: false,
                cost: 150,
                participants: 10,
                sessions: [{ startsAt: new Date().toISOString() }],
              },
            ],
          },
        };
      }
      return { data: { participants: 10 } };
    });

    render(
      <QueryClientProvider client={client()}>
        <EventosPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Congreso de Medicina')).toBeDefined();
    expect(screen.getByText('Bs 150.00')).toBeDefined();
    expect(screen.getByText(/Recaudado:/)).toBeDefined();
  });

  it('ResumenTab displays 4th metric card for Monto Recaudado when event is paid', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events/e-paid/stats') {
        return {
          data: {
            participants: 12,
            eligible: 8,
            sessions: 2,
            perSession: [{ checkedIn: 10 }],
            isFree: false,
            cost: 100,
            totalRecaudado: 1200,
          },
        };
      }
      if (url === '/events/e-paid') {
        return {
          data: {
            status: 'ABIERTO',
            bannerPath: '/banner.jpg',
            slug: 'congreso-pago',
            isFree: false,
            cost: 100,
          },
        };
      }
      if (url === '/sessions/event/e-paid') {
        return { data: { data: [{ id: 's1' }] } };
      }
      if (url.includes('/certificate-templates')) {
        return { data: { data: [{ isDefault: true }] } };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={client()}>
        <ResumenTab eventId="e-paid" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Monto Recaudado')).toBeDefined();
    expect(screen.getByText(/12 inscritos × Bs 100.00/)).toBeDefined();
  });

  it('ParticipantsTable displays Recaudación total when event has cost', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url.startsWith('/participants/event/e-paid')) {
        return {
          data: {
            data: [],
            pagination: { total: 25, totalPages: 1, page: 1 },
            totalSessions: 1,
          },
        };
      }
      if (url === '/events/e-paid') {
        return {
          data: {
            isFree: false,
            cost: 200,
          },
        };
      }
      if (url.startsWith('/sessions/event/e-paid')) {
        return { data: { data: [] } };
      }
      if (url.includes('/certificate-templates')) {
        return { data: { data: [] } };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={client()}>
        <ParticipantsTable
          eventId="e-paid"
          slug="congreso-pago"
          onGoCertificados={() => {}}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Recaudación total:/)).toBeDefined();
    expect(screen.getByText(/5\.000,00|5,000.00/)).toBeDefined();
  });
});
