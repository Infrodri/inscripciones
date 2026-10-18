import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import QRCode from 'qrcode';
import {
  renderBadgeSheet,
  renderSingleBadge,
  mmToPt,
  type BadgeParticipant,
} from '../src/badges.js';

describe('Credential Badges Generator', () => {
  async function dummyQr(): Promise<Buffer> {
    return QRCode.toBuffer('TEST-QR-CODE-1234567890', { type: 'png', margin: 2, width: 256 });
  }

  function streamToBuffer(stream: PassThrough): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  it('converts mm to points accurately for standard 85x120mm card', () => {
    const wPt = mmToPt(85);
    const hPt = mmToPt(120);
    expect(Math.round(wPt)).toBe(241);
    expect(Math.round(hPt)).toBe(340);
  });

  it('renders a single standalone badge PDF with valid structure', async () => {
    const qrBuffer = await dummyQr();
    const participant: BadgeParticipant = {
      fullName: 'DR. MARCELO QUIROGA SANTA CRUZ',
      ci: '1234567-CH',
      type: 'EXPOSITOR',
      institution: 'Universidad San Francisco Xavier',
      career: 'Docente Investigador & Expositor Principal',
      eventTitle: 'Congreso Internacional de Derecho Constitucional y DDHH',
      eventInstitution: 'Facultad de Derecho, Ciencias Políticas y Sociales',
      eventDates: '24 oct - 26 oct 2026',
      eventLocation: 'Paraninfo Universitario',
      qrPngBuffer: qrBuffer,
    };

    const stream = new PassThrough();
    const bufferPromise = streamToBuffer(stream);
    await renderSingleBadge(participant, stream);
    const pdf = await bufferPromise;

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders badge sheet with 4 badges per A4 page', async () => {
    const qrBuffer = await dummyQr();
    const roles = ['ESTUDIANTE', 'EXPOSITOR', 'ORGANIZADOR', 'MODERADOR', 'DOCENTE'];
    const participants: BadgeParticipant[] = roles.map((r, i) => ({
      fullName: `Participante de Prueba ${i + 1} Con Nombre Extenso`,
      ci: `CI-${1000000 + i}`,
      type: r,
      institution: 'Carrera de Derecho - USFX',
      career: 'Derecho y Ciencias Políticas',
      eventTitle: 'Simposio Nacional de Derecho Procesal',
      eventInstitution: 'Facultad de Derecho, Ciencias Políticas y Sociales',
      eventDates: '18 nov 2026',
      eventLocation: 'Aula Magna',
      qrPngBuffer: qrBuffer,
    }));

    const stream = new PassThrough();
    const bufferPromise = streamToBuffer(stream);
    const count = await renderBadgeSheet(participants, stream);
    const pdf = await bufferPromise;

    expect(count).toBe(5);
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('handles optional CI cleanly when missing for VIP speakers or committee', async () => {
    const qrBuffer = await dummyQr();
    const speaker: BadgeParticipant = {
      fullName: 'DRA. GABRIELA MISTRAL',
      ci: null,
      type: 'EXPOSITOR',
      institution: 'Universidad de Chile',
      career: 'Expositora Internacional',
      eventTitle: 'Seminario Latinoamericano de Derecho',
      eventInstitution: 'Facultad de Derecho, Ciencias Políticas y Sociales',
      eventDates: '15 dic 2026',
      eventLocation: 'Salón de Honor',
      qrPngBuffer: qrBuffer,
    };

    const stream = new PassThrough();
    const bufferPromise = streamToBuffer(stream);
    await renderSingleBadge(speaker, stream);
    const pdf = await bufferPromise;

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
