import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionScanActions } from '../components/admin/SessionScanActions';

describe('SessionScanActions', () => {
  it('enlaza a /scan/<sessionId>', () => {
    render(<SessionScanActions sessionId="abc-123" />);
    expect(screen.getByText('Abrir escáner').getAttribute('href')).toBe('/scan/abc-123');
  });

  it('copia el enlace absoluto del escáner', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SessionScanActions sessionId="abc-123" />);
    fireEvent.click(screen.getByText('Copiar enlace del escáner'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/scan/abc-123'));
  });
});
