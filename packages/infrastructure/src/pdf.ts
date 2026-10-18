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
  printBackground?: boolean;
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
    if (job.printBackground !== false) {
      doc.image(job.image, 0, 0, { width: pageW, height: pageH });
    }
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

export interface AttendanceListSession {
  label: string | null;
  startsAt: Date;
  location: string | null;
  rows: Array<{ fullName: string; ci: string }>;
}

// Lista de asistencia imprimible (respaldo sin internet): A4 vertical, una
// sesión por página, columnas Nº / nombre / CI / firma.
export async function renderAttendanceList(
  eventTitle: string,
  sessions: AttendanceListSession[],
  out: Writable
): Promise<{ pages: number; rows: number }> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false });
  doc.pipe(out);
  let rows = 0;
  for (const session of sessions) {
    doc.addPage();
    doc.fontSize(14).text(eventTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(session.label ?? 'Sesión', { align: 'center' });
    doc.fontSize(10).text(new Date(session.startsAt).toLocaleString('es-BO'), { align: 'center' });
    if (session.location) doc.fontSize(10).text(session.location, { align: 'center' });
    doc.moveDown(1);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const cols = [30, width - 30 - 110 - 130, 110, 130];
    doc.fontSize(9);
    let y = doc.y;
    const header = ['Nº', 'Apellidos y nombres', 'CI', 'Firma'];
    header.forEach((text, i) => {
      doc.text(text, left + cols.slice(0, i).reduce((a, b) => a + b, 0), y, { width: cols[i] });
    });
    y += 16;
    session.rows.forEach((row, index) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const cells = [String(index + 1), row.fullName, row.ci, ''];
      cells.forEach((text, i) => {
        doc.text(text, left + cols.slice(0, i).reduce((a, b) => a + b, 0), y, { width: cols[i] });
      });
      doc
        .moveTo(left, y + 14)
        .lineTo(left + width, y + 14)
        .stroke();
      y += 20;
      rows += 1;
    });
  }
  doc.end();
  await new Promise<void>((resolve) => out.on('finish', () => resolve()));
  return { pages: sessions.length, rows };
}
