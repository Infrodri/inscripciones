export interface DetectedPage {
  pageWidthMm: number;
  pageHeightMm: number;
  match: string;
  warning: string | null;
}

// Página deducida de la proporción. 2000×1414 ≈ A4 apaisado (297×210).
// Si no coincide con A4/Carta (tolerancia 2%), se pide confirmación.
export function detectPageSize(widthPx: number, heightPx: number): DetectedPage {
  const landscape = widthPx >= heightPx;
  const ratio = landscape ? widthPx / heightPx : heightPx / widthPx;
  const candidates = [
    { match: 'A4 apaisado', ratio: 297 / 210, w: 297, h: 210 },
    { match: 'Carta apaisado', ratio: 279.4 / 215.9, w: 279.4, h: 215.9 },
    { match: 'A4 vertical', ratio: 297 / 210, w: 210, h: 297 },
    { match: 'Carta vertical', ratio: 279.4 / 215.9, w: 215.9, h: 279.4 },
  ];
  for (const candidate of candidates) {
    const candidateLandscape = candidate.w >= candidate.h;
    if (candidateLandscape !== landscape) continue;
    if (Math.abs(ratio - candidate.ratio) / candidate.ratio <= 0.02) {
      return {
        pageWidthMm: candidate.w,
        pageHeightMm: candidate.h,
        match: candidate.match,
        warning: null,
      };
    }
  }
  return {
    pageWidthMm: 297,
    pageHeightMm: 210,
    match: 'A4 apaisado (supuesto)',
    warning: 'La proporción no coincide con A4 ni Carta: confirme el tamaño antes de exportar',
  };
}

export interface NameLayout {
  sizePt: number;
  lines: string[];
  shrunk: boolean;
  overflow: boolean;
}

// auto_shrink: reduce hasta el mínimo; si no cabe, parte en dos líneas;
// si aun así no cabe, lo informa (overflow) sin recortar en silencio.
export function layoutName(
  text: string,
  maxWidthPt: number,
  sizePt: number,
  minPt: number,
  measure: (text: string, sizePt: number) => number
): NameLayout {
  const clean = text.trim().replace(/\s+/g, ' ');
  let size = sizePt;
  while (size > minPt && measure(clean, size) > maxWidthPt) size -= 0.5;
  if (measure(clean, size) <= maxWidthPt) {
    return { sizePt: size, lines: [clean], shrunk: size < sizePt, overflow: false };
  }
  const words = clean.split(' ');
  for (let i = 1; i < words.length; i += 1) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    if (measure(lines[0], minPt) <= maxWidthPt && measure(lines[1], minPt) <= maxWidthPt) {
      return { sizePt: minPt, lines, shrunk: true, overflow: false };
    }
  }
  const mid = Math.ceil(words.length / 2);
  return {
    sizePt: minPt,
    lines: [words.slice(0, mid).join(' '), words.slice(mid).join(' ')],
    shrunk: true,
    overflow: true,
  };
}

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function dpiAtSize(widthPx: number, pageWidthMm: number): number {
  return widthPx / (pageWidthMm / 25.4);
}
