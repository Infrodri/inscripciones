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

// Nombre SIEMPRE en una sola línea: reduce en pasos de 0,5 pt hasta el piso
// de 8 pt. Si no cabe, se imprime al piso, se marca `overflow` en el reporte
// y se avisa en la UI. Nunca se recorta ni se parte.
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
  const fits = measure(clean, size) <= maxWidthPt;
  return { sizePt: size, lines: [clean], shrunk: size < sizePt, overflow: !fits };
}

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function dpiAtSize(widthPx: number, pageWidthMm: number): number {
  return widthPx / (pageWidthMm / 25.4);
}
