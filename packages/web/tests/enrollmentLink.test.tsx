import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnrollmentLinkCard } from '../components/admin/EnrollmentLinkCard';
import { CopyBroadcastButton } from '../components/CopyBroadcastButton';

describe('EnrollmentLinkCard', () => {
  it('muestra la URL completa y el QR descargable', () => {
    render(<EnrollmentLinkCard slug="mi-evento" />);
    expect(screen.getByText(/\/e\/mi-evento/)).toBeDefined();
    expect(screen.getByText('Abrir')).toBeDefined();
    expect(screen.getByText('Descargar QR')).toBeDefined();
  });

  it('prioritizes window.location.origin over process.env.NEXT_PUBLIC_SITE_URL', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://stale-domain.vercel.app';
    render(<EnrollmentLinkCard slug="mi-evento-priority" />);
    // In JSDOM, window.location.origin is http://localhost:3000
    expect(screen.getByText('http://localhost:3000/e/mi-evento-priority')).toBeDefined();
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
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

describe('CopyBroadcastButton', () => {
  it('copia el mensaje de difusión con formato y enlace dinámico', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Congreso de Derecho 2026',
        location: 'Paraninfo Universitario',
        isFree: true,
        sessions: [
          { startsAt: '2026-10-25T14:00:00.000Z', endsAt: '2026-10-25T18:00:00.000Z' },
        ],
      }),
    } as Response);

    render(<CopyBroadcastButton slug="congreso-derecho" />);
    fireEvent.click(screen.getByText('Copiar mensaje de difusión'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });

    const callArg = writeText.mock.calls[0][0] as string;
    expect(callArg).toContain('📢 *Congreso de Derecho 2026*');
    expect(callArg).toContain('📍 *Lugar:* Paraninfo Universitario');
    expect(callArg).toContain('💰 *Inversión:* Gratuito');
    expect(callArg).toContain('http://localhost:3000/e/congreso-derecho');

    global.fetch = originalFetch;
  });
});
