import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import EventosPage from '../app/admin/eventos/page';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
    getSessionUser: () => ({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/eventos',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;

function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('EventosPage dialog regression & trigger isolation', () => {
  it('mounts event list with 0 dialog elements and renders independent sibling action buttons', async () => {
    mockedGet().mockImplementation(async (url: string) => {
      if (url === '/events') {
        return {
          data: {
            data: [
              { id: 'ev-1', slug: 'evento-1', title: 'Evento 1', status: 'ABIERTO' },
              { id: 'ev-2', slug: 'evento-2', title: 'Evento 2', status: 'ABIERTO' },
              { id: 'ev-3', slug: 'evento-3', title: 'Evento 3', status: 'BORRADOR' },
            ],
          },
        };
      }
      if (url.startsWith('/sessions/event/')) {
        return { data: { data: [] } };
      }
      return { data: { participants: 0 } };
    });

    const { container } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <EventosPage />
      </QueryClientProvider>
    );

    // Wait until events are rendered
    expect(await screen.findByText('Evento 1')).toBeDefined();
    expect(screen.getByText('Evento 2')).toBeDefined();
    expect(screen.getByText('Evento 3')).toBeDefined();

    // REGRESSION GUARD: No dialogs mounted on initial page load
    const dialogs = container.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(dialogs.length).toBe(0);

    // Verify independent sibling buttons ("Abrir", "Duplicar", "Eliminar") exist
    const abrirButtons = screen.getAllByText('Abrir');
    const duplicarButtons = screen.getAllByText('Duplicar');
    const eliminarButtons = screen.getAllByText('Eliminar');

    expect(abrirButtons.length).toBe(3);
    expect(duplicarButtons.length).toBe(3);
    expect(eliminarButtons.length).toBe(3);

    // Check that "Eliminar" is a direct sibling of "Duplicar" and "Abrir", NOT wrapped in ConfirmDialog
    const firstEliminar = eliminarButtons[0];
    const buttonGroup = firstEliminar.parentElement;
    expect(buttonGroup).toBeDefined();
    expect(buttonGroup?.contains(abrirButtons[0])).toBe(true);
    expect(buttonGroup?.contains(duplicarButtons[0])).toBe(true);

    // Clicking "Eliminar" opens exactly 1 ConfirmDialog
    fireEvent.click(firstEliminar);

    const activeDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(activeDialogs.length).toBe(1);
    expect(screen.getByText('¿Eliminar "Evento 1"? Esta acción no se puede deshacer.')).toBeDefined();

    // Closing the dialog restores count to 0
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    const closedDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(closedDialogs.length).toBe(0);
  });
});
