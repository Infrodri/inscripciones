import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageHeader } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';

const { mockReplace, mockBack } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockBack: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: vi.fn() }),
  usePathname: () => '/admin/eventos',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Navegación', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
  });
  it('muestra migas de pan', () => {
    render(
      <PageHeader
        titulo="Detalle"
        migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Detalle' }]}
        volverA="/admin/eventos"
      />
    );
    expect(screen.getByRole('navigation', { name: 'Migas de pan' })).toBeDefined();
    expect(screen.getByText('Eventos')).toBeDefined();
  });

  it('Volver usa fallback sin referrer', () => {
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    render(<PageHeader titulo="X" volverA="/admin/eventos" />);
    fireEvent.click(screen.getByText('← Volver'));
    expect(mockReplace).toHaveBeenCalledWith('/admin/eventos');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Volver regresa con referrer del mismo origen', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost:3000/admin/eventos',
      configurable: true,
    });
    window.history.pushState({}, '', '/admin/eventos/1');
    render(<PageHeader titulo="X" volverA="/admin/eventos" />);
    fireEvent.click(screen.getByText('← Volver'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Dialog', () => {
  it('cierra con Esc y devuelve el foco', () => {
    const onCerrar = vi.fn();
    render(
      <>
        <button type="button">Abrir</button>
        <Dialog titulo="Diálogo" onCerrar={onCerrar}>
          <button type="button">Dentro</button>
        </Dialog>
      </>
    );
    (screen.getByText('Abrir') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('Abrir');
  });
});
