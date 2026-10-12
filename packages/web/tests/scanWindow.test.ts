import { describe, expect, it } from 'vitest';
import { formatLaPaz, isSessionActiveNow, scanPath } from '../lib/scanWindow';

const STARTS = '2026-10-12T18:00:00-04:00';

describe('isSessionActiveNow', () => {
  it('activa dentro de la ventana (60 min)', () => {
    expect(
      isSessionActiveNow(new Date('2026-10-12T17:30:00-04:00').getTime(), STARTS, null, 60)
    ).toBe(true);
  });

  it('inactiva fuera de la ventana', () => {
    expect(
      isSessionActiveNow(new Date('2026-10-12T16:00:00-04:00').getTime(), STARTS, null, 60)
    ).toBe(false);
  });

  it('sin endsAt usa inicio + 4h', () => {
    expect(
      isSessionActiveNow(new Date('2026-10-12T22:30:00-04:00').getTime(), STARTS, null, 60)
    ).toBe(true);
    expect(
      isSessionActiveNow(new Date('2026-10-12T23:30:00-04:00').getTime(), STARTS, null, 60)
    ).toBe(false);
  });

  it('respeta endsAt explícito', () => {
    const ends = '2026-10-12T19:00:00-04:00';
    expect(
      isSessionActiveNow(new Date('2026-10-12T19:30:00-04:00').getTime(), STARTS, ends, 60)
    ).toBe(true);
    expect(
      isSessionActiveNow(new Date('2026-10-12T20:30:00-04:00').getTime(), STARTS, ends, 60)
    ).toBe(false);
  });
});

describe('formatLaPaz', () => {
  it('usa el formato único', () => {
    expect(formatLaPaz(STARTS)).toBe('lun 12 oct 2026 · 18:00');
  });
});

describe('scanPath', () => {
  it('arma la ruta del escáner', () => {
    expect(scanPath('abc-123')).toBe('/scan/abc-123');
  });
});
