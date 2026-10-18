import type { Writable } from 'node:stream';
import PDFDocument from 'pdfkit';

export interface BadgeParticipant {
  fullName: string;
  ci: string;
  type: string; // 'ESTUDIANTE' | 'DOCENTE' | 'PROFESIONAL' | 'PUBLICO' | 'EXPOSITOR' | 'ORGANIZADOR'
  institution?: string | null;
  career?: string | null;
  eventTitle: string;
  eventInstitution?: string | null;
  eventDates?: string | null;
  eventLocation?: string | null;
  qrPngBuffer: Buffer;
}

// Convert mm to PostScript points (72 points / inch, 25.4 mm / inch)
function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

function getRoleColors(type: string): { bg: string; text: string; label: string } {
  switch (type.toUpperCase()) {
    case 'EXPOSITOR':
      return { bg: '#B45309', text: '#FFFFFF', label: 'EXPOSITOR' };
    case 'ORGANIZADOR':
      return { bg: '#991B1B', text: '#FFFFFF', label: 'ORGANIZADOR' };
    case 'DOCENTE':
      return { bg: '#1E3A8A', text: '#FFFFFF', label: 'DOCENTE' };
    case 'PROFESIONAL':
      return { bg: '#0F766E', text: '#FFFFFF', label: 'PROFESIONAL' };
    case 'PUBLICO':
      return { bg: '#374151', text: '#FFFFFF', label: 'ASISTENTE' };
    case 'ESTUDIANTE':
    default:
      return { bg: '#0A2A5E', text: '#FFFFFF', label: 'ESTUDIANTE' };
  }
}

/**
 * Draws a single badge card within a given bounding box (x, y, w, h in points).
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
  // Card background
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fill('#FFFFFF');

  if (drawBorder) {
    doc.roundedRect(x, y, w, h, 8).lineWidth(1).stroke('#D9DEE7');
  }

  // Header band (Institutional Navy)
  const headerHeight = mmToPt(32);
  doc.rect(x, y, w, headerHeight).fill('#0A2A5E');
  // Gold accent strip below header
  doc.rect(x, y + headerHeight - 3, w, 3).fill('#C9A227');

  // University Header Text
  doc
    .fillColor('#C9A227')
    .fontSize(6)
    .font('Helvetica-Bold')
    .text('UNIVERSIDAD SAN FRANCISCO XAVIER DE CHUQUISACA', x + 6, y + 5, {
      width: w - 12,
      align: 'center',
    });

  doc
    .fillColor('#E5E7EB')
    .fontSize(5.5)
    .font('Helvetica')
    .text(
      p.eventInstitution ?? 'Facultad de Derecho, Ciencias Políticas y Sociales',
      x + 6,
      y + 13,
      {
        width: w - 12,
        align: 'center',
      }
    );

  // Event title in header
  doc
    .fillColor('#FFFFFF')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text(p.eventTitle, x + 6, y + 20, {
      width: w - 12,
      align: 'center',
      ellipsis: true,
      height: 10,
    });

  // Event Dates / Location strip
  const dateLoc = [p.eventDates, p.eventLocation].filter(Boolean).join(' • ');
  let currentY = y + headerHeight + mmToPt(3);
  if (dateLoc) {
    doc
      .fillColor('#6B7280')
      .fontSize(6)
      .font('Helvetica')
      .text(dateLoc, x + 6, currentY, {
        width: w - 12,
        align: 'center',
        ellipsis: true,
      });
    currentY += mmToPt(4);
  }

  // Role Pill
  const role = getRoleColors(p.type);
  const pillY = currentY;
  const pillW = mmToPt(42);
  const pillH = mmToPt(7);
  const pillX = x + (w - pillW) / 2;

  doc.roundedRect(pillX, pillY, pillW, pillH, 4).fill(role.bg);
  doc
    .fillColor(role.text)
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text(role.label, pillX, pillY + 2, {
      width: pillW,
      align: 'center',
    });

  // Participant Name (Large & Centered)
  const nameY = pillY + pillH + mmToPt(5);
  const maxNameWidth = w - mmToPt(16);
  let fontSize = 15;
  if (p.fullName.length > 28) fontSize = 12;
  if (p.fullName.length > 36) fontSize = 10;

  doc
    .fillColor('#0A2A5E')
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .text(p.fullName, x + mmToPt(8), nameY, {
      width: maxNameWidth,
      align: 'center',
    });

  // Subtitle: Career or Institution
  const subY = nameY + mmToPt(10);
  const subtitle = p.career ? `${p.career}` : p.institution ? `${p.institution}` : '';
  if (subtitle) {
    doc
      .fillColor('#4B5563')
      .fontSize(8.5)
      .font('Helvetica')
      .text(subtitle, x + mmToPt(8), subY, {
        width: maxNameWidth,
        align: 'center',
        ellipsis: true,
      });
  }

  // CI
  const ciY = subY + (subtitle ? mmToPt(5) : 0);
  doc
    .fillColor('#6B7280')
    .fontSize(7.5)
    .font('Helvetica')
    .text(`CI: ${p.ci}`, x + mmToPt(8), ciY, {
      width: maxNameWidth,
      align: 'center',
    });

  // QR Code Image
  const qrSize = mmToPt(40);
  const qrX = x + (w - qrSize) / 2;
  const qrY = y + h - qrSize - mmToPt(12);

  doc.image(p.qrPngBuffer, qrX, qrY, {
    fit: [qrSize, qrSize],
    align: 'center',
    valign: 'center',
  });

  // Footer: Validation note
  doc
    .fillColor('#9CA3AF')
    .fontSize(6)
    .font('Helvetica')
    .text('Control de Asistencia y Acreditación', x + 8, y + h - mmToPt(7), {
      width: w - 16,
      align: 'center',
    });

  doc.restore();
}

/**
 * Generates an A4 sheet layout (4 badges per page: 2 cols x 2 rows, ~95x135mm each),
 * with dashed cut guides. Streamed directly to response.
 */
export async function renderBadgeSheet(
  participants: BadgeParticipant[],
  out: Writable
): Promise<number> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: mmToPt(10),
    autoFirstPage: false,
  });

  doc.pipe(out);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = mmToPt(10);
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;

  const cols = 2;
  const rows = 2;
  const badgeW = (usableW - mmToPt(8)) / cols; // ~91mm
  const badgeH = (usableH - mmToPt(8)) / rows; // ~134mm
  const gap = mmToPt(8);

  let currentOnPage = 0;

  for (let i = 0; i < participants.length; i++) {
    if (currentOnPage === 0) {
      doc.addPage();
      // Draw cut guides (dashed lines)
      doc.save();
      doc.strokeColor('#E5E7EB').lineWidth(0.5).dash(4, { space: 4 });
      // Vertical center guide
      const midX = margin + badgeW + gap / 2;
      doc.moveTo(midX, 0).lineTo(midX, pageHeight).stroke();
      // Horizontal center guide
      const midY = margin + badgeH + gap / 2;
      doc.moveTo(0, midY).lineTo(pageWidth, midY).stroke();
      doc.restore();
    }

    const col = currentOnPage % cols;
    const row = Math.floor(currentOnPage / cols);
    const x = margin + col * (badgeW + gap);
    const y = margin + row * (badgeH + gap);

    drawBadgeCard(doc, participants[i], x, y, badgeW, badgeH, true);

    currentOnPage++;
    if (currentOnPage >= cols * rows) {
      currentOnPage = 0;
    }
  }

  doc.end();
  await new Promise<void>((resolve) => out.on('finish', () => resolve()));
  return participants.length;
}

/**
 * Generates a single standalone badge PDF (90mm x 130mm card) for an attendee to print or save.
 */
export async function renderSingleBadge(
  participant: BadgeParticipant,
  out: Writable
): Promise<void> {
  const w = mmToPt(90);
  const h = mmToPt(130);

  const doc = new PDFDocument({
    size: [w, h],
    margin: 0,
    autoFirstPage: true,
  });

  doc.pipe(out);
  drawBadgeCard(doc, participant, 0, 0, w, h, false);
  doc.end();

  await new Promise<void>((resolve) => out.on('finish', () => resolve()));
}
