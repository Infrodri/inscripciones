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
let decanaTemplateId = '';
let directorTemplateId = '';

const NAME_BOX = {
  xPct: 10,
  yPct: 45,
  wPct: 80,
  hPct: 12,
  fontKey: 'serif',
  sizePt: 48,
  color: '#000000',
  align: 'center',
  nameCase: 'AS_TYPED',
  autoShrink: true,
};

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${adminToken}`, ...(init.headers ?? {}) },
  });
}

async function uploadTemplate(name: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 2000, height: 1414, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'plantilla.png');
  form.append('name', name);
  form.append('roleKind', 'ORGANIZADOR');
  form.append('nameBox', JSON.stringify(NAME_BOX));
  const res = await api(`/api/v1/events/${eventId}/certificate-templates/upload`, {
    method: 'POST',
    body: form,
  });
  return ((await res.json()) as { template: { id: string } }).template.id;
}

describe('H7 organizadores', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `h7-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'H7', role: 'ADMIN' },
    });
    adminToken = (
      (await (
        await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'Admin1234!' }),
        })
      ).json()) as { token: string }
    ).token;
    const event = (await (
      await api(`/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: `h7-${stamp}`,
          title: 'H7',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    decanaTemplateId = await uploadTemplate('Organizador Decana');
    directorTemplateId = await uploadTemplate('Organizador Director');
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h7-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h7-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('pegado de lista crea varios con la misma variante', async () => {
    const res = await api(`/api/v1/events/${eventId}/certificate-recipients/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleKind: 'ORGANIZADOR',
        templateId: decanaTemplateId,
        items: [
          { fullName: 'Mgtr. Ingrid Amanda Iris Pereira Poppe', note: 'Decana a.i.' },
          { fullName: 'Dr. Mario Abdón Linares Linares', note: 'Director a.i.' },
          { fullName: 'Mgtr. Ingrid Amanda Iris Pereira Poppe' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: unknown[]; duplicates: string[] };
    expect(body.created).toHaveLength(2);
    expect(body.duplicates).toHaveLength(1);
  });

  it('exporta por variante de plantilla', async () => {
    const decana = await api(
      `/api/v1/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all&templateId=${decanaTemplateId}`
    );
    expect(decana.status).toBe(200);
    expect((await decana.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    const director = await api(
      `/api/v1/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all&templateId=${directorTemplateId}`
    );
    expect(director.status).toBe(200);
  });
});
