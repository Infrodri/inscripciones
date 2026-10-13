import { describe, expect, it } from 'vitest';
import { detectPageSize, layoutName } from '../src/application/certificateService.js';

const measure = (text: string, size: number): number => text.length * size * 0.6;

describe('detectPageSize', () => {
  it('2000×1414 es A4 apaisado', () => {
    const page = detectPageSize(2000, 1414);
    expect(page.pageWidthMm).toBe(297);
    expect(page.warning).toBeNull();
  });
  it('proporción rara avisa y pide confirmación', () => {
    const page = detectPageSize(1000, 1000);
    expect(page.warning).toMatch(/confirme/);
  });
});

describe('layoutName', () => {
  it('nombre corto conserva el tamaño', () => {
    const layout = layoutName('Ana Pérez', 300, 48, 8, measure);
    expect(layout.sizePt).toBe(48);
    expect(layout.overflow).toBe(false);
  });
  it('nombre largo se reduce y si no cabe avisa en una sola línea', () => {
    const layout = layoutName(
      'María Eugenia Santiváñez Rocha de la Fuente del Valle',
      200,
      48,
      8,
      measure
    );
    expect(layout.shrunk).toBe(true);
    expect(layout.lines).toHaveLength(1);
    expect(layout.overflow).toBe(true);
  });
  it('si no cabe ni al piso, lo informa en una sola línea', () => {
    const layout = layoutName('A'.repeat(200), 10, 48, 8, measure);
    expect(layout.overflow).toBe(true);
    expect(layout.lines).toHaveLength(1);
    expect(layout.sizePt).toBe(8);
  });
});
