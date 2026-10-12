import type { Writable } from 'node:stream';
import PDFDocument from 'pdfkit';
import { layoutName, mmToPt, dpiAtSize } from './certificates.js';

export type FontKey = 'sans' | 'serif' | 'script';

export interface PdfNameBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  fontKey: FontKey;
  sizePt: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface CertificateJob {
  image: Buffer;
  widthPx: number;
  pageWidthMm: number;
  pageHeightMm: number;
  name: string;
  nameBox: PdfNameBox;
}

export interface PdfReport {
  generated: number;
  shrunk: number;
  overflow: string[];
  lowDpi: number;
}

// Un certificado por página; la imagen ocupa la página completa en mm reales.
// Lote en streaming: las páginas se escriben al stream sin acumular en memoria.
export async function renderCertificates(
  jobs: CertificateJob[],
  fonts: Record<FontKey, string>,
  out: Writable
): Promise<PdfReport> {
  const report: PdfReport = { generated: 0, shrunk: 0, overflow: [], lowDpi: 0 };
  if (jobs.length === 0) {
    const empty = new PDFDocument({ autoFirstPage: false });
    empty.pipe(out);
    empty.end();
    await new Promise<void>((resolve) => out.on('finish', () => resolve()));
    return report;
  }
  const first = jobs[0];
  const doc = new PDFDocument({
    size: [mmToPt(first.pageWidthMm), mmToPt(first.pageHeightMm)],
    margin: 0,
    autoFirstPage: false,
  });
  doc.pipe(out);
  for (const [index, job] of jobs.entries()) {
    const pageW = mmToPt(job.pageWidthMm);
    const pageH = mmToPt(job.pageHeightMm);
    doc.addPage({ size: [pageW, pageH], margin: 0 });
    doc.image(job.image, 0, 0, { width: pageW, height: pageH });
    if (dpiAtSize(job.widthPx, job.pageWidthMm) < 150) report.lowDpi += 1;
    const box = job.nameBox;
    const fontPath = fonts[box.fontKey];
    doc.font(fontPath);
    const measure = (text: string, size: number): number => {
      doc.font(fontPath).fontSize(size);
      return doc.widthOfString(text);
    };
    const boxWPt = (box.wPct / 100) * pageW;
    const layout = layoutName(job.name, boxWPt, box.sizePt, 8, measure);
    if (layout.shrunk) report.shrunk += 1;
    if (layout.overflow) report.overflow.push(job.name);
    doc.font(fontPath).fontSize(layout.sizePt).fillColor(box.color);
    const xPt = (box.xPct / 100) * pageW;
    const yPt = (box.yPct / 100) * pageH;
    const lineHeight = layout.sizePt * 1.2;
    layout.lines.forEach((line, lineIndex) => {
      doc.text(line, xPt, yPt + lineIndex * lineHeight, { width: boxWPt, align: box.align });
    });
    report.generated = index + 1;
    void first;
  }
  doc.end();
  await new Promise<void>((resolve) => out.on('finish', () => resolve()));
  return report;
}

export { mmToPt };
