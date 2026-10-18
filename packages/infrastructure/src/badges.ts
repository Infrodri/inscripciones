import fs from 'node:fs';
import path from 'node:path';
import type { Writable } from 'node:stream';
import PDFDocument from 'pdfkit';

export interface BadgeParticipant {
  fullName: string;
  ci?: string | null;
  type: string; // 'ESTUDIANTE' | 'DOCENTE' | 'PROFESIONAL' | 'PUBLICO' | 'EXPOSITOR' | 'ORGANIZADOR' | 'MODERADOR'
  institution?: string | null;
  career?: string | null;
  eventTitle: string;
  eventInstitution?: string | null;
  eventDates?: string | null;
  eventLocation?: string | null;
  qrPngBuffer: Buffer;
  headerImageBuffer?: Buffer | null;
}

// Convert mm to PostScript points (72 points / inch, 25.4 mm / inch)
export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

let cachedHeaderImage: Buffer | null = null;
let imageSearchAttempted = false;

function getHeaderImage(): Buffer | null {
  if (imageSearchAttempted) return cachedHeaderImage;
  imageSearchAttempted = true;

  const candidatePaths: string[] = [
    path.resolve(__dirname, '../assets/facultad-derecho-usfx.jpg'),
    path.resolve(__dirname, 'assets/facultad-derecho-usfx.jpg'),
    path.resolve(__dirname, '../../assets/facultad-derecho-usfx.jpg'),
    path.resolve(__dirname, '../../web/public/facultad-derecho-usfx.jpg'),
    path.resolve(__dirname, '../../../packages/web/public/facultad-derecho-usfx.jpg'),
    path.resolve(__dirname, '../../../packages/infrastructure/assets/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), 'packages/infrastructure/assets/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), 'packages/web/public/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), 'assets/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), 'public/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), '../infrastructure/assets/facultad-derecho-usfx.jpg'),
    path.resolve(process.cwd(), '../web/public/facultad-derecho-usfx.jpg'),
  ];



  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        cachedHeaderImage = fs.readFileSync(p);
        break;
      }
    } catch {
      // Continue searching
    }
  }

  return cachedHeaderImage;
}

function getRoleColors(type: string): { bg: string; text: string; label: string } {
  switch (type.toUpperCase()) {
    case 'EXPOSITOR':
      return { bg: '#B45309', text: '#FFFFFF', label: 'EXPOSITOR' };
    case 'MODERADOR':
      return { bg: '#C2410C', text: '#FFFFFF', label: 'MODERADOR' };
    case 'ORGANIZADOR':
      return { bg: '#991B1B', text: '#FFFFFF', label: 'ORGANIZADOR' };
    case 'AUSPICIANTE':
    case 'SPONSOR':
      return { bg: '#047857', text: '#FFFFFF', label: 'AUSPICIANTE' };
    case 'DOCENTE':
      return { bg: '#1E3A8A', text: '#FFFFFF', label: 'DOCENTE' };
    case 'PROFESIONAL':
      return { bg: '#0F766E', text: '#FFFFFF', label: 'PROFESIONAL' };
    case 'PUBLICO':
    case 'ASISTENTE':
      return { bg: '#334155', text: '#FFFFFF', label: 'ASISTENTE' };
    case 'ESTUDIANTE':
    default:
      return { bg: '#0A2A5E', text: '#FFFFFF', label: type ? type.toUpperCase() : 'ESTUDIANTE' };
  }
}

/**
 * Draws a single badge card within a given bounding box (x, y, w, h in points).
 * Standard accreditation badge size: 85mm x 120mm.
 */
function drawBadgeCard(
  doc: typeof PDFDocument,
  p: BadgeParticipant,
  x: number,
  y: number,
  w: number,
  h: number,
  drawBorder = true
): void {
  doc.save();

  // Card Background
  doc.roundedRect(x, y, w, h, 8).fill('#FFFFFF');

  // Outer border
  if (drawBorder) {
    doc.roundedRect(x, y, w, h, 8).lineWidth(0.8).stroke('#CBD5E1');
  }

  // Header banner height (25.5mm gives ideal proportion for 120mm card)
  const headerHeight = mmToPt(25.5);

  // Clip header to rounded top corners of the card
  doc.save();
  doc.roundedRect(x, y, w, h, 8).clip();

  const headerImg = p.headerImageBuffer ?? getHeaderImage();
  if (headerImg) {
    try {
      doc.image(headerImg, x, y, {
        cover: [w, headerHeight],
        align: 'center',
        valign: 'center',
      });
      // Dark institutional navy tint/overlay (#0A2A5E at ~68% opacity)
      doc.save();
      doc.rect(x, y, w, headerHeight).fillColor('#0A2A5E', 0.68).fill();
      doc.restore();
    } catch {
      doc.rect(x, y, w, headerHeight).fill('#0A2A5E');
    }
  } else {
    doc.rect(x, y, w, headerHeight).fill('#0A2A5E');
  }

  // Gold accent strip below header
  const goldStripHeight = mmToPt(1.2);
  doc.rect(x, y + headerHeight - goldStripHeight, w, goldStripHeight).fill('#C9A227');

  // Header typography
  // 1. Institutional university line in gold
  doc
    .fillColor('#C9A227')
    .fontSize(6)
    .font('Helvetica-Bold')
    .text('UNIVERSIDAD SAN FRANCISCO XAVIER DE CHUQUISACA', x + 6, y + mmToPt(3.2), {
      width: w - 12,
      align: 'center',
    });

  // 2. Faculty line in white / light gray
  doc
    .fillColor('#E2E8F0')
    .fontSize(5.5)
    .font('Helvetica')
    .text(
      p.eventInstitution ?? 'Facultad de Derecho, Ciencias Políticas y Sociales',
      x + 6,
      y + mmToPt(6.8),
      {
        width: w - 12,
        align: 'center',
        ellipsis: true,
      }
    );

  // 3. Event title centered in header
  const eventTitleSize = p.eventTitle.length > 60 ? 6.8 : p.eventTitle.length > 40 ? 7.4 : 8;
  doc
    .fillColor('#FFFFFF')
    .fontSize(eventTitleSize)
    .font('Helvetica-Bold')
    .text(p.eventTitle, x + 6, y + mmToPt(10.8), {
      width: w - 12,
      align: 'center',
      ellipsis: true,
      height: mmToPt(12),
      lineGap: 1,
    });

  doc.restore(); // Restore header clipping

  // --- CARD BODY ---
  let currentY = y + headerHeight + mmToPt(2.8);

  // Event Dates / Location strip
  const dateLoc = [p.eventDates, p.eventLocation].filter(Boolean).join(' • ');
  if (dateLoc) {
    doc
      .fillColor('#64748B')
      .fontSize(5.8)
      .font('Helvetica')
      .text(dateLoc, x + 6, currentY, {
        width: w - 12,
        align: 'center',
        ellipsis: true,
      });
    currentY += mmToPt(3.8);
  }

  // Role Pill Badge
  const role = getRoleColors(p.type);
  const pillY = currentY;
  const pillW = mmToPt(42);
  const pillH = mmToPt(6.2);
  const pillX = x + (w - pillW) / 2;

  doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(role.bg);
  doc
    .fillColor(role.text)
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text(role.label, pillX, pillY + mmToPt(1.3), {
      width: pillW,
      align: 'center',
    });

  currentY = pillY + pillH + mmToPt(3.2);

  // Attendee Full Name (Prominent, elegant, well-padded)
  const cleanName = p.fullName.trim();
  const maxNameWidth = w - mmToPt(10);
  let nameFontSize = 14;
  if (cleanName.length > 22) nameFontSize = 12.5;
  if (cleanName.length > 30) nameFontSize = 11;
  if (cleanName.length > 38) nameFontSize = 9.5;

  doc
    .fillColor('#0A2A5E')
    .fontSize(nameFontSize)
    .font('Helvetica-Bold')
    .text(cleanName, x + mmToPt(5), currentY, {
      width: maxNameWidth,
      align: 'center',
      lineGap: 1,
    });

  const nameLinesEstimate = cleanName.length > 28 ? 2 : 1;
  currentY += (nameLinesEstimate === 2 ? mmToPt(9) : mmToPt(5.5)) + mmToPt(2);

  // Career / Institution Subtitle
  const subtitle =
    [p.career, p.institution].filter(Boolean).join(' • ') ||
    (p.career ?? p.institution ?? '');
  if (subtitle) {
    doc
      .fillColor('#475569')
      .fontSize(7.5)
      .font('Helvetica')
      .text(subtitle, x + mmToPt(5), currentY, {
        width: maxNameWidth,
        align: 'center',
        ellipsis: true,
      });
    currentY += mmToPt(4.2);
  }

  // CI (only rendered if present)
  if (p.ci && p.ci.trim() !== '') {
    doc
      .fillColor('#64748B')
      .fontSize(7.2)
      .font('Helvetica-Bold')
      .text(`CI: ${p.ci.trim()}`, x + mmToPt(5), currentY, {
        width: maxNameWidth,
        align: 'center',
      });
  }

  // QR Code Image (Clean, sharp, 30mm with white container padding)
  const qrSize = mmToPt(30);
  const qrPadding = mmToPt(1.8);
  const containerSize = qrSize + qrPadding * 2;
  const qrX = x + (w - containerSize) / 2;
  const qrY = y + h - mmToPt(11) - containerSize;

  // White container card with subtle border
  doc.roundedRect(qrX, qrY, containerSize, containerSize, 4).fill('#FFFFFF');
  doc.roundedRect(qrX, qrY, containerSize, containerSize, 4).lineWidth(0.75).stroke('#E2E8F0');

  try {
    doc.image(p.qrPngBuffer, qrX + qrPadding, qrY + qrPadding, {
      fit: [qrSize, qrSize],
      align: 'center',
      valign: 'center',
    });
  } catch {
    doc.fontSize(7).fillColor('#DC2626').text('QR no disponible', qrX, qrY + qrSize / 2, {
      width: qrSize,
      align: 'center',
    });
  }

  // Footer: Micro divider and text
  const lineW = mmToPt(26);
  doc
    .moveTo(x + (w - lineW) / 2, y + h - mmToPt(8))
    .lineTo(x + (w + lineW) / 2, y + h - mmToPt(8))
    .lineWidth(0.5)
    .strokeColor('#E2E8F0')
    .stroke();

  doc
    .fillColor('#94A3B8')
    .fontSize(5.6)
    .font('Helvetica')
    .text('Control de Asistencia y Acreditación', x + 8, y + h - mmToPt(6.5), {
      width: w - 16,
      align: 'center',
    });

  doc.restore();
}

/**
 * Generates an A4 sheet layout (4 badges per page: 2 cols x 2 rows, 85mm x 120mm each),
 * centered in each quadrant with dashed cut guides. Streamed directly to response.
 */
export async function renderBadgeSheet(
  participants: BadgeParticipant[],
  out: Writable
): Promise<number> {
  const pageWidth = mmToPt(210); // A4 width: 595.28 pt
  const pageHeight = mmToPt(297); // A4 height: 841.89 pt

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    autoFirstPage: false,
  });

  doc.pipe(out);

  if (participants.length === 0) {
    doc.end();
    await new Promise<void>((resolve) => out.on('finish', () => resolve()));
    return 0;
  }

  const cols = 2;
  const rows = 2;

  const quarterW = pageWidth / 2; // 105mm in pt
  const quarterH = pageHeight / 2; // 148.5mm in pt
  const badgeW = mmToPt(85);
  const badgeH = mmToPt(120);
  const offsetX = (quarterW - badgeW) / 2; // ~10mm in pt
  const offsetY = (quarterH - badgeH) / 2; // ~14.25mm in pt

  let currentOnPage = 0;

  for (let i = 0; i < participants.length; i++) {
    if (currentOnPage === 0) {
      doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });

      // Draw subtle dashed cut guides dividing the page into 4 quadrants
      doc.save();
      doc.strokeColor('#CBD5E1').lineWidth(0.5).dash(4, { space: 4 });

      // Vertical center guide (105mm)
      doc.moveTo(quarterW, 0).lineTo(quarterW, pageHeight).stroke();

      // Horizontal center guide (148.5mm)
      doc.moveTo(0, quarterH).lineTo(pageWidth, quarterH).stroke();

      doc.restore();
    }

    const col = currentOnPage % cols;
    const row = Math.floor(currentOnPage / cols);
    const x = col * quarterW + offsetX;
    const y = row * quarterH + offsetY;

    drawBadgeCard(doc, participants[i], x, y, badgeW, badgeH, true);

    currentOnPage++;
    if (currentOnPage >= cols * rows) {
      currentOnPage = 0;
    }
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve());
    out.on('error', (err) => reject(err));
    doc.on('error', (err) => reject(err));
  });
  return participants.length;
}

/**
 * Generates a single standalone badge PDF (85mm x 120mm standard card)
 * for an attendee, speaker or organizer to print or view.
 */
export async function renderSingleBadge(
  participant: BadgeParticipant,
  out: Writable
): Promise<void> {
  const w = mmToPt(85);
  const h = mmToPt(120);

  const doc = new PDFDocument({
    size: [w, h],
    margin: 0,
    autoFirstPage: true,
  });

  doc.pipe(out);
  drawBadgeCard(doc, participant, 0, 0, w, h, false);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve());
    out.on('error', (err) => reject(err));
    doc.on('error', (err) => reject(err));
  });
}
