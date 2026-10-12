import { describe, expect, it } from 'vitest';
import { formatFecha, formatFechaHora } from '../lib/format';

describe('formatFechaHora', () => {
  it('formato legible America/La_Paz', () => {
    expect(formatFechaHora('2026-10-12T18:00:00-04:00')).toBe('lun 12 oct 2026 · 18:00');
  });

  it('convierte desde UTC', () => {
    expect(formatFechaHora('2026-10-12T22:00:00Z')).toBe('lun 12 oct 2026 · 18:00');
  });

  it('formatFecha sin hora', () => {
    expect(formatFecha('2026-10-12T18:00:00-04:00')).toBe('lun 12 oct 2026');
  });
});
