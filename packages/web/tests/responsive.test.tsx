import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminChrome } from '../components/admin/AdminChrome';
import { ParticipantsTable } from '../components/admin/ParticipantsTable';
import { api } from '../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => mockedPath,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: { get: vi.fn() } };
});

let mockedPath = '/admin/eventos';

function setPath(path: string): void {
  mockedPath = path;
}

describe('responsive sin desborde', () => {
  beforeEach(() => {
    setPath('/admin/eventos');
    vi.clearAllMocks();
  });

  it('login sin sidebar (sin elementos ajenos ni ancho fijo)', () => {
    setPath('/admin/login');
    render(
      <AdminChrome>
        <p>formulario</p>
      </AdminChrome>
    );
    expect(screen.queryByText('Administración')).toBeNull();
    expect(screen.getByText('formulario')).toBeDefined();
  });

  it('sidebar colapsable en móvil y fija en escritorio', () => {
    const { container } = render(
      <AdminChrome>
        <p>contenido</p>
      </AdminChrome>
    );
    expect(screen.getByLabelText('Abrir menú')).toBeDefined();
    const aside = container.querySelector('aside');
    expect(aside?.className).toMatch(/-translate-x-full/);
    expect(aside?.className).toMatch(/md:static/);
    expect(aside?.className).toMatch(/md:w-56/);
    expect(aside?.className).not.toMatch(/(^|\s)w-56(\s|$)/);
  });

  it('tabla de inscritos con desplazamiento interno', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('/sessions/event/')) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({
        data: {
          data: [
            {
              id: '1',
              firstName: 'Ana',
              lastName: 'Pérez',
              ci: '1',
              email: 'a@t.com',
              type: 'PUBLICO',
            },
          ],
          pagination: { total: 1 },
        },
      });
    });
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <ParticipantsTable eventId="e1" slug="s" onGoCertificados={() => undefined} />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Pérez/)).toBeDefined();
    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();
  });
});
