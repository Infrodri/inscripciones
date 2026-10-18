import { describe, it, expect } from 'vitest';

describe('Contraste de variantes de Button (ratio ≥ 4.5:1)', () => {
  // Función helper para calcular luminosidad relativa (WCAG 2.1)
  function getLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
      const c = val / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace('#', '');
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16),
      };
    }
    if (clean.length === 6) {
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
      };
    }
    return null;
  }

  function contrastRatio(fg: string, bg: string): number {
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Paleta de tokens del proyecto (desde globals.css)
  const tokens = {
    navy: '#0A2A5E',
    navyHover: '#1F4E96',
    gold: '#C9A227',
    canvas: '#F5F6F9',
    surface: '#FFFFFF',
    line: '#D9DEE7',
    ink: '#1B2433',
    muted: '#5B6677',
    ok: '#1E7B4F',
    okBg: '#E6F4EC',
    warn: '#B7791F',
    warnBg: '#FAF3E3',
    danger: '#B42318',
    dangerBg: '#FDECEA',
  };

  // Variantes de Button con sus colores de fondo y texto
  const buttonVariants = [
    {
      name: 'primario',
      bg: tokens.navy,
      text: '#FFFFFF',
      hoverBg: tokens.navyHover,
    },
    {
      name: 'secundario',
      bg: tokens.surface,
      text: tokens.ink,
      border: tokens.line,
      hoverBorder: tokens.navy,
    },
    {
      name: 'peligro',
      bg: tokens.danger,
      text: '#FFFFFF',
    },
    {
      name: 'fantasma',
      bg: tokens.canvas, // fondo real donde se renderiza (canvas)
      text: tokens.ink,
      hoverBg: tokens.line,
    },
  ];

  it('cada variante de Button cumple ratio de contraste ≥ 4.5:1 (texto vs fondo)', () => {
    const failures: string[] = [];

    for (const variant of buttonVariants) {
      const ratio = contrastRatio(variant.text, variant.bg);
      if (ratio < 4.5) {
        failures.push(
          `${variant.name}: ratio ${ratio.toFixed(2)}:1 (texto ${variant.text} sobre fondo ${variant.bg}) < 4.5:1`
        );
      }

      // Verificar estado hover si tiene hoverBg
      if (variant.hoverBg) {
        const hoverRatio = contrastRatio(variant.text, variant.hoverBg);
        if (hoverRatio < 4.5) {
          failures.push(`${variant.name} (hover): ratio ${hoverRatio.toFixed(2)}:1 < 4.5:1`);
        }
      }
    }

    if (failures.length > 0) {
      // console.log('Fallos de contraste:', failures.join('\n'));
    }

    expect(failures).toHaveLength(0);
  });

  it('variante secundario: texto ink sobre surface cumple 4.5:1', () => {
    const ratio = contrastRatio(tokens.ink, tokens.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('variante primario: texto blanco sobre navy cumple 4.5:1', () => {
    const ratio = contrastRatio('#FFFFFF', tokens.navy);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('variante peligro: texto blanco sobre danger cumple 4.5:1', () => {
    const ratio = contrastRatio('#FFFFFF', tokens.danger);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('variante fantasma (hover): texto ink sobre line cumple 4.5:1', () => {
    const ratio = contrastRatio(tokens.ink, tokens.line);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
