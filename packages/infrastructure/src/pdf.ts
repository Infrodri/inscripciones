// Exportación PDF de certificados (implementación completa en FASE E1).
// La imagen ocupa la página completa en tamaño real en mm; streaming por lotes.
export interface CertificatePdfPage {
  imageBuffer: Buffer;
  pageWidthMm: number;
  pageHeightMm: number;
  printedName: string;
}

export function mmFromPixels(px: number, dpi = 300): number {
  return (px / dpi) * 25.4;
}
