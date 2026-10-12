import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnrollmentLinkCard } from '../components/admin/EnrollmentLinkCard';

describe('EnrollmentLinkCard', () => {
  it('muestra la URL completa y el QR descargable', () => {
    render(<EnrollmentLinkCard slug="mi-evento" />);
    expect(screen.getByText(/\/e\/mi-evento/)).toBeDefined();
    expect(screen.getByText('Abrir')).toBeDefined();
    expect(screen.getByText('Descargar QR')).toBeDefined();
  });

  it('copia el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<EnrollmentLinkCard slug="mi-evento" />);
    fireEvent.click(screen.getByText('Copiar'));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/e/mi-evento'))
    );
    expect(await screen.findByText('Copiado')).toBeDefined();
  });
});
