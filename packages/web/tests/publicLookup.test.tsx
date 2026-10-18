import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CertificateLookup } from '@/components/public/CertificateLookup';
import { EventFilters } from '@/components/public/EventFilters';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
  apiErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Error inesperado'
  ),
}));

describe('CertificateLookup component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state with empty inputs and verify button', () => {
    render(<CertificateLookup />);
    expect(screen.getByLabelText(/Cédula de Identidad/i)).toBeDefined();
    expect(screen.getByLabelText(/Código de Verificación/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Verificar Validez/i })).toBeDefined();
  });

  it('submits verification request and displays authentic certificate on success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        valid: true,
        certificate: {
          eventTitle: 'Congreso Internacional de Derecho 2026',
          eventDate: '2026-11-20T14:00:00Z',
          recipientName: 'Carlos A. P. G.',
          role: 'ASISTENTE',
        },
      },
    });

    render(<CertificateLookup />);
    fireEvent.change(screen.getByLabelText(/Cédula de Identidad/i), {
      target: { value: '10452345' },
    });
    fireEvent.change(screen.getByLabelText(/Código de Verificación/i), {
      target: { value: 'cert-123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verificar Validez/i }));

    await waitFor(() => {
      expect(screen.getByText(/Certificado Auténtico y Válido/i)).toBeDefined();
      expect(screen.getByText(/Congreso Internacional de Derecho 2026/i)).toBeDefined();
      expect(screen.getByText(/Carlos A. P. G./i)).toBeDefined();
    });
  });

  it('displays not-found warning when certificate is invalid', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        valid: false,
        message: 'No se encontró un certificado válido con los datos proporcionados',
      },
    });

    render(<CertificateLookup />);
    fireEvent.change(screen.getByLabelText(/Cédula de Identidad/i), {
      target: { value: '10452345' },
    });
    fireEvent.change(screen.getByLabelText(/Código de Verificación/i), {
      target: { value: 'codigo-erroneo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verificar Validez/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/No se encontró un certificado válido/i).length).toBeGreaterThan(
        0
      );
    });
  });
});

describe('EventFilters component', () => {
  it('calls onSearchChange when input text changes', () => {
    const onSearchChange = vi.fn();
    render(
      <EventFilters
        search=""
        onSearchChange={onSearchChange}
        selectedKind="TODOS"
        onKindChange={vi.fn()}
        availableKinds={['TODOS', 'Congreso', 'Seminario']}
        selectedModality="TODAS"
        onModalityChange={vi.fn()}
        onClearFilters={vi.fn()}
        totalFiltered={5}
      />
    );

    const input = screen.getByLabelText(/Buscar eventos/i);
    fireEvent.change(input, { target: { value: 'derecho' } });
    expect(onSearchChange).toHaveBeenCalledWith('derecho');
  });

  it('renders available kind buttons with correct active aria-pressed state', () => {
    const onKindChange = vi.fn();
    render(
      <EventFilters
        search=""
        onSearchChange={vi.fn()}
        selectedKind="Congreso"
        onKindChange={onKindChange}
        availableKinds={['TODOS', 'Congreso', 'Seminario']}
        selectedModality="TODAS"
        onModalityChange={vi.fn()}
        onClearFilters={vi.fn()}
        totalFiltered={2}
      />
    );

    const congresoBtn = screen.getByRole('button', { name: 'Congreso' });
    expect(congresoBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Seminario' }));
    expect(onKindChange).toHaveBeenCalledWith('Seminario');
  });
});
