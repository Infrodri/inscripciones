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
let expositorTemplateId = '';
let organizadorTemplateId = '';

const NAME_BOX = {
  xPct: 10,
  yPct: 45,
  wPct: 80,
  hPct: 12,
  fontKey: 'sans',
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

async function uploadTemplate(name: string, roleKind: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 2000, height: 1414, channels: 3, background: { r: 245, g: 245, b: 245 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'plantilla.png');
  form.append('name', name);
  form.append('roleKind', roleKind);
  form.append('nameBox', JSON.stringify(NAME_BOX));
  const res = await api(`/api/v1/events/${eventId}/certificate-templates/upload`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json()) as { template: { id: string } };
  return body.template.id;
}

describe('H6 expositores', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `h6-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'H6', role: 'ADMIN' },
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
          slug: `h6-${stamp}`,
          title: 'H6',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    expositorTemplateId = await uploadTemplate('Expositor base', 'EXPOSITOR');
    organizadorTemplateId = await uploadTemplate('Organizador base', 'ORGANIZADOR');
    await api(`/api/v1/certificate-templates/${expositorTemplateId}/set-default`, {
      method: 'POST',
    });
    const prisma2 = getPrisma();
    await prisma2.speaker.create({
      data: {
        eventId,
        fullName: 'Dr. César Suárez Saavedra',
        titleProfession: 'Abogado y docente',
        role: 'EXPOSITOR',
        position: 0,
      },
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h6-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h6-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('cargar desde expositores crea receptores con la default', async () => {
    const res = await api(`/api/v1/events/${eventId}/certificate-recipients/from-speakers`, {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: Array<{ fullName: string }>; skipped: string[] };
    expect(body.created).toHaveLength(1);
    expect(body.created[0].fullName).toBe('Dr. César Suárez Saavedra');
  });

  it('rechaza plantilla de otro rol (TEMPLATE_ROLE_MISMATCH)', async () => {
    const res = await api(`/api/v1/events/${eventId}/certificate-recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleKind: 'EXPOSITOR',
        fullName: 'Dr. Test',
        templateId: organizadorTemplateId,
      }),
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'TEMPLATE_ROLE_MISMATCH'
    );
  });

  it('rechaza receptor duplicado (DUPLICATE_RECIPIENT)', async () => {
    const payload = {
      roleKind: 'EXPOSITOR',
      fullName: 'Dra. Única',
      templateId: expositorTemplateId,
    };
    const first = await api(`/api/v1/events/${eventId}/certificate-recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const second = await api(`/api/v1/events/${eventId}/certificate-recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, fullName: '  dra. única ' }),
    });
    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: { code: string } }).error.code).toBe(
      'DUPLICATE_RECIPIENT'
    );
  });

  it('exporta el rol expositor en PDF', async () => {
    const res = await api(
      `/api/v1/events/${eventId}/exports/certificates.pdf?roleKind=EXPOSITOR&scope=all`
    );
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});
