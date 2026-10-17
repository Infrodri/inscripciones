import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import UsuariosPage from '../app/admin/usuarios/page';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    getSessionUser: () => ({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Administrador',
      role: 'ADMIN',
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/usuarios',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedGet = () => api.get as unknown as ReturnType<typeof vi.fn>;

function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('UsuariosPage & Button institutional redesign and regression guards', () => {
  const mockUsers = [
    {
      id: 'usr-1',
      email: 'juan@example.com',
      name: 'Juan Perez',
      role: 'ADMIN',
      active: true,
      createdAt: '2026-10-12T14:30:00Z',
    },
    {
      id: 'usr-2',
      email: 'maria@example.com',
      name: 'Maria Gomez',
      role: 'STAFF',
      active: true,
      createdAt: '2026-10-14T09:15:00Z',
    },
  ];

  it('renders PageHeader, breadcrumbs, search/filter card, table and mobile cards', async () => {
    mockedGet().mockResolvedValue({
      data: { data: mockUsers },
    });

    const { container } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <UsuariosPage />
      </QueryClientProvider>
    );

    // Verify PageHeader breadcrumbs and navigation
    expect(screen.getByText('Administración')).toBeDefined();
    expect(screen.getAllByText('Usuarios').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('← Volver')).toBeDefined();
    expect(screen.getByText('+ Nuevo usuario')).toBeDefined();

    // Verify Search and Filter card inputs
    expect(screen.getByLabelText('Buscar')).toBeDefined();
    expect(screen.getByLabelText('Rol')).toBeDefined();

    // Verify user data is rendered
    expect(await screen.findAllByText('Juan Perez')).toBeDefined();
    expect(screen.getAllByText('Maria Gomez')).toBeDefined();
    expect(screen.getAllByText('juan@example.com')).toBeDefined();
    expect(screen.getAllByText('maria@example.com')).toBeDefined();

    // REGRESSION GUARD: No dialogs mounted on initial page load
    const initialDialogs = container.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(initialDialogs.length).toBe(0);

    // Verify role badges
    expect(screen.getAllByText('ADMIN')).toBeDefined();
    expect(screen.getAllByText('STAFF')).toBeDefined();

    // Verify action buttons are independent sibling elements
    const editButtons = screen.getAllByText('Editar / Cambiar rol');
    const deleteButtons = screen.getAllByText('Eliminar');

    expect(editButtons.length).toBeGreaterThan(0);
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Verify first delete button is sibling of edit button, NOT wrapped in ConfirmDialog
    const firstDelete = deleteButtons[0];
    const buttonContainer = firstDelete.parentElement;
    expect(buttonContainer?.contains(editButtons[0])).toBe(true);

    // Clicking Eliminar opens single ConfirmDialog
    fireEvent.click(firstDelete);

    const activeDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(activeDialogs.length).toBe(1);
    expect(screen.getByText(/¿Eliminar al usuario/)).toBeDefined();

    // Clicking Cancelar closes ConfirmDialog
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    const closedDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    expect(closedDialogs.length).toBe(0);
  });

  it('filters users by search query and role', async () => {
    mockedGet().mockResolvedValue({
      data: { data: mockUsers },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <UsuariosPage />
      </QueryClientProvider>
    );

    expect(await screen.findAllByText('Juan Perez')).toBeDefined();

    // Filter by search query
    const searchInput = screen.getByLabelText('Buscar');
    fireEvent.change(searchInput, { target: { value: 'maria' } });

    expect(screen.queryByText('Juan Perez')).toBeNull();
    expect(screen.getAllByText('Maria Gomez')).toBeDefined();

    // Filter by role
    fireEvent.change(searchInput, { target: { value: '' } });
    const roleSelect = screen.getByLabelText('Rol');
    fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

    expect(screen.getAllByText('Juan Perez')).toBeDefined();
    expect(screen.queryByText('Maria Gomez')).toBeNull();
  });

  it('opens and closes create user dialog from "+ Nuevo usuario" button', async () => {
    mockedGet().mockResolvedValue({
      data: { data: mockUsers },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <UsuariosPage />
      </QueryClientProvider>
    );

    const newButton = screen.getByText('+ Nuevo usuario');
    fireEvent.click(newButton);

    expect(screen.getByRole('dialog', { name: 'Nuevo usuario' })).toBeDefined();
    expect(screen.getByLabelText('Nombre completo')).toBeDefined();
    expect(screen.getByLabelText('Correo electrónico')).toBeDefined();

    // Close create dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelButton);

    expect(screen.queryByRole('dialog', { name: 'Nuevo usuario' })).toBeNull();
  });

  it('Button variant="primario" strictly enforces !text-white in standard, hover, and asChild modes', () => {
    const { container: standardBtn } = render(
      <Button variant="primario">Guardar</Button>
    );
    const btnEl = standardBtn.querySelector('button');
    expect(btnEl?.className).toContain('!text-white');
    expect(btnEl?.className).toContain('hover:!text-white');

    const { container: asChildBtn } = render(
      <Button variant="primario" asChild>
        <a href="/test" className="text-blue-500">
          Enlace
        </a>
      </Button>
    );
    const linkEl = asChildBtn.querySelector('a');
    expect(linkEl?.className).toContain('!text-white');
    expect(linkEl?.className).toContain('hover:!text-white');
  });
});
