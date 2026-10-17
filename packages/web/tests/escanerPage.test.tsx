import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EscanerPage from '../app/admin/escaner/page';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: { get: vi.fn(), post: vi.fn() } };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/escaner',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = () => api.post as unknown as ReturnType<typeof vi.fn>;

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('EscanerPage - Mejoras institucionales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filtra eventos en BORRADOR por defecto y los muestra con el toggle', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [
              { id: 'e-activo', title: 'Evento Activo', status: 'ABIERTO', checkinWindowMinutes: 60 },
              { id: 'e-borrador', title: 'Evento Borrador', status: 'BORRADOR', checkinWindowMinutes: 60 },
            ],
          },
        };
      }
      if (url === '/sessions/event/e-activo') {
        return {
          data: {
            data: [
              {
                id: 's-activo',
                startsAt: new Date().toISOString(),
                endsAt: null,
                label: 'Sesión Principal',
                location: 'Aula Magna',
              },
            ],
          },
        };
      }
      if (url === '/sessions/event/e-borrador') {
        return {
          data: {
            data: [
              {
                id: 's-borrador',
                startsAt: new Date().toISOString(),
                endsAt: null,
                label: 'Sesión Borrador',
                location: 'Laboratorio',
              },
            ],
          },
        };
      }
      return { data: { perSession: [{ id: 's-activo', checkedIn: 12 }] } };
    });

    render(
      <QueryClientProvider client={client()}>
        <EscanerPage />
      </QueryClientProvider>
    );

    // Evento activo visible
    expect(await screen.findByText('Evento Activo')).toBeDefined();
    expect(screen.getByText('Sesión Principal')).toBeDefined();
    expect(screen.getByText('12 registrados')).toBeDefined();
    expect(screen.getByText(/Aula Magna/)).toBeDefined();

    // Evento borrador NO debe estar visible por defecto
    expect(screen.queryByText('Evento Borrador')).toBeNull();

    // Activar toggle "Mostrar borradores"
    const toggle = screen.getByRole('switch', { name: 'Mostrar borradores' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    // Ahora debe estar visible
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Evento Borrador')).toBeDefined();
    expect(screen.getByText('Sesión Borrador')).toBeDefined();
  });

  it('agrupa sesiones en bloques Hoy, Próximas y Pasadas según America/La_Paz', async () => {
    // Hoy
    const nowIso = new Date().toISOString();
    // Próxima: +5 días
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureIso = futureDate.toISOString();
    // Pasada: -5 días
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastIso = pastDate.toISOString();

    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [{ id: 'e1', title: 'Congreso', status: 'ABIERTO', checkinWindowMinutes: 60 }],
          },
        };
      }
      if (url.startsWith('/sessions/event/')) {
        return {
          data: {
            data: [
              { id: 's-hoy', startsAt: nowIso, endsAt: null, label: 'Sesión de Hoy', location: 'Auditorio A' },
              { id: 's-futuro', startsAt: futureIso, endsAt: null, label: 'Sesión Futura', location: 'Auditorio B' },
              { id: 's-pasado', startsAt: pastIso, endsAt: null, label: 'Sesión Pasada', location: 'Auditorio C' },
            ],
          },
        };
      }
      return { data: { perSession: [] } };
    });

    render(
      <QueryClientProvider client={client()}>
        <EscanerPage />
      </QueryClientProvider>
    );

    // Bloque Hoy destacado
    expect(await screen.findByText('Sesiones de Hoy')).toBeDefined();
    expect(screen.getByText('Sesión de Hoy')).toBeDefined();

    // Bloque Próximas
    expect(screen.getByText('Próximas Sesiones')).toBeDefined();
    expect(screen.getByText('Sesión Futura')).toBeDefined();

    // Bloque Pasadas
    expect(screen.getByText('Sesiones Pasadas')).toBeDefined();
    expect(screen.getByText('Sesión Pasada')).toBeDefined();
  });

  it('permite copiar el enlace del escáner al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [{ id: 'e1', title: 'Congreso', status: 'ABIERTO', checkinWindowMinutes: 60 }],
          },
        };
      }
      return {
        data: {
          data: [{ id: 's1', startsAt: new Date().toISOString(), endsAt: null, label: 'Sesión 1' }],
        },
      };
    });

    render(
      <QueryClientProvider client={client()}>
        <EscanerPage />
      </QueryClientProvider>
    );

    const copiarBtn = await screen.findByText('Copiar enlace');
    fireEvent.click(copiarBtn);
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/scan/s1'));
  });

  it('abre el modal Proyectar QR y permite alternar auto-registro', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [{ id: 'e1', title: 'Congreso', status: 'ABIERTO', checkinWindowMinutes: 60 }],
          },
        };
      }
      if (url.startsWith('/sessions/event/')) {
        return {
          data: {
            data: [
              {
                id: 's1',
                startsAt: new Date().toISOString(),
                endsAt: null,
                label: 'Sesión Magistral',
                selfCheckinOpen: false,
              },
            ],
          },
        };
      }
      if (url === '/sessions/s1') {
        return { data: { id: 's1', selfCheckinOpen: false } };
      }
      if (url === '/sessions/s1/self-checkin/token') {
        return {
          data: {
            qrPngUrl: '/api/v1/sessions/s1/self-checkin/qr.png',
            url: 'https://test.bo/a/token123',
          },
        };
      }
      if (url.includes('/self-checkin/qr.png')) {
        return { data: new Blob(['fake-png-data'], { type: 'image/png' }) };
      }
      return { data: { perSession: [{ id: 's1', checkedIn: 8 }] } };
    });

    mockedPost().mockResolvedValue({ data: { success: true } });

    render(
      <QueryClientProvider client={client()}>
        <EscanerPage />
      </QueryClientProvider>
    );

    const proyectarBtn = await screen.findByText('Proyectar QR');
    fireEvent.click(proyectarBtn);

    // El diálogo modal debe abrirse
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByText('Proyección de Asistencia')).toBeDefined();
    expect(screen.getByText('Descargar imagen QR')).toBeDefined();

    // Alternar auto-registro
    const toggleSelf = screen.getByRole('switch', { name: 'Alternar estado de auto-registro' });
    fireEvent.click(toggleSelf);

    await waitFor(() => {
      expect(mockedPost()).toHaveBeenCalledWith('/sessions/s1/self-checkin/open');
    });

    // Cerrar modal
    const cerrarBtn = screen.getByRole('button', { name: 'Cerrar diálogo' });
    fireEvent.click(cerrarBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
