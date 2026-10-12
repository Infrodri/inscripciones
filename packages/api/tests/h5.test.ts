import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const stamp = Date.now();
let baseUrl = '';
let adminToken = '';
let server: Server | null = null;
let eventId = '';
let templateId = '';

const NAME_BOX = {
  xPct: 55,
  yPct: 45,
  wPct: 40,
  hPct: 12,
  fontKey: 'serif',
  sizePt: 48,
  color: '#000000',
  align: 'left',
  nameCase: 'TITLE',
  autoShrink: true,
};

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
}

async function uploadTemplate(name: string, roleKind: string): Promise<Response> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 2000, height: 1414, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'plantilla.png');
  form.append('name', name);
  form.append('roleKind', roleKind);
  form.append('nameBox', JSON.stringify(NAME_BOX));
  return api(`/api/v1/events/${eventId}/certificate-templates/upload`, adminToken, {
    method: 'POST',
    body: form,
  });
}

describe('H5 plantillas y asistente', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `h5-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'H5', role: 'ADMIN' },
    });
    adminToken = (
      (await (
        await api('/api/v1/auth/login', null, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'Admin1234!' }),
        })
      ).json()) as { token: string }
    ).token;
    const event = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: `h5-${stamp}`,
          title: 'H5',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h5-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h5-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('sube plantilla y detecta A4 apaisado', async () => {
    const res = await uploadTemplate('Asistente base', 'ASISTENTE');
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      template: { id: string };
      page: { match: string; warning: null };
    };
    expect(body.page.match).toMatch(/A4/);
    expect(body.page.warning).toBeNull();
    templateId = body.template.id;
  });

  it('marcar default y duplicar variante', async () => {
    const setDefault = await api(
      `/api/v1/certificate-templates/${templateId}/set-default`,
      adminToken,
      { method: 'POST' }
    );
    expect(setDefault.status).toBe(200);
    const dup = await api(`/api/v1/certificate-templates/${templateId}/duplicate`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Asistente variante' }),
    });
    expect(dup.status).toBe(201);
    expect(((await dup.json()) as { isDefault: boolean }).isDefault).toBe(false);
  });

  it('vista previa de 1 página en PDF', async () => {
    const res = await api(
      `/api/v1/certificate-templates/${templateId}/preview.pdf?sampleName=Ana Pérez`,
      adminToken
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it('exporta aptos y genera certificate_code perezoso', async () => {
    const prisma = getPrisma();
    const session = await prisma.session.create({
      data: { eventId, startsAt: new Date(Date.now() - 10 * 60_000) },
    });
    const participant = await prisma.participant.create({
      data: {
        eventId,
        firstName: 'María Eugenia',
        lastName: 'Santiváñez Rocha',
        ci: `H5-${stamp}`,
        email: `h5-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `h5-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    await prisma.attendance.create({
      data: { participantId: participant.id, sessionId: session.id, method: 'QR' },
    });
    // Nombre muy largo con ñ/tildes: la reducción automática debe generar igual.
    const longName = await prisma.participant.create({
      data: {
        eventId,
        firstName: 'María Eugenia Santiváñez Rocha de la Fuente del Valle Muy Larga',
        lastName: 'Peña Muñoz de los Santos',
        ci: `H5L-${stamp}`,
        email: `h5l-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `h5l-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    await prisma.attendance.create({
      data: { participantId: longName.id, sessionId: session.id, method: 'QR' },
    });
    const res = await api(
      `/api/v1/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=eligible`,
      adminToken
    );
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } });
    expect(updated?.certificateCode).toMatch(/.+/);
  });

  it('sin plantilla default responde NO_DEFAULT_TEMPLATE', async () => {
    const other = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: `h5-nodefault-${stamp}`,
          title: 'H5',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    const res = await api(
      `/api/v1/events/${other.id}/exports/certificates.pdf?roleKind=ASISTENTE`,
      adminToken
    );
    expect(res.status).toBe(422);
  });
});
