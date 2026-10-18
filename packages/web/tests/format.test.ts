import { describe, expect, it } from 'vitest';
import {
  formatFecha,
  formatFechaHora,
  formatCosto,
  normalizeText,
  formatModality,
  getProximaSesion,
} from '../lib/format';

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

describe('formatCosto', () => {
  it('muestra Gratuito cuando isFree es true', () => {
    expect(formatCosto(true)).toBe('Gratuito');
    expect(formatCosto(true, 50)).toBe('Gratuito');
  });

  it('muestra el monto en Bs cuando es de pago y tiene costo', () => {
    expect(formatCosto(false, 50)).toBe('50 Bs');
    expect(formatCosto(false, 120.5)).toBe('120.5 Bs');
  });

  it('evita null Bs mostrando Consultar costo', () => {
    expect(formatCosto(false, null)).toBe('Consultar costo');
    expect(formatCosto(false, undefined)).toBe('Consultar costo');
    expect(formatCosto(false, 0)).toBe('Consultar costo');
  });
});

describe('normalizeText', () => {
  it('elimina tildes y diacríticos y pasa a minúsculas', () => {
    expect(normalizeText('Tecnología y Ética Jurídica')).toBe('tecnologia y etica juridica');
    expect(normalizeText('Constitución')).toBe('constitucion');
    expect(normalizeText('   Sucre - Bolivia   ')).toBe('sucre - bolivia');
  });
});

describe('formatModality', () => {
  it('mapea las modalidades a español legible', () => {
    expect(formatModality('PRESENCIAL')).toBe('Presencial');
    expect(formatModality('VIRTUAL')).toBe('Virtual');
    expect(formatModality('HIBRIDO')).toBe('Híbrido');
  });
});

describe('getProximaSesion', () => {
  it('retorna null si no hay sesiones', () => {
    expect(getProximaSesion([])).toBeNull();
    expect(getProximaSesion(null)).toBeNull();
  });

  it('retorna la sesión futura más próxima', () => {
    const s1 = { startsAt: '2026-11-20T10:00:00Z' };
    const s2 = { startsAt: '2026-11-25T10:00:00Z' };
    expect(getProximaSesion([s2, s1])).toEqual(s1);
  });
});
