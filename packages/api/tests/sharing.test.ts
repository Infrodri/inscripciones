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
let staffToken = '';
let server: Server | null = null;
let eventA = '';
let eventB = '';
let sharedId = '';

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

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
}

async function uploadTemplate(eventId: string, name: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 2000, height: 1414, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'plantilla.png');
  form.append('name', name);
  form.append('roleKind', 'ASISTENTE');
  form.append('nameBox', JSON.stringify(NAME_BOX));
  const res = await api(`/api/v1/events/${eventId}/certificate-templates/upload`, adminToken, {
    method: 'POST',
    body: form,
  });
  return ((await res.json()) as { template: { id: string } }).template.id;
}

async function createEvent(slug: string): Promise<string> {
  const res = (await (
    await api('/api/v1/events', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'SH',
        eventKind: 'K',
        institution: 'I',
        organizer: 'O',
        location: 'L',
      }),
    })
  ).json()) as { id: string };
  return res.id;
}

describe('Compartir plantillas', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `sh-admin-${stamp}@test.com`;
    const staffEmail = `sh-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'SH',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'SH',
        role: 'STAFF',
      },
    });
    const login = async (email: string, password: string): Promise<string> =>
      (
        (await (
          await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
        ).json()) as { token: string }
      ).token;
    adminToken = await login(adminEmail, 'Admin1234!');
    staffToken = await login(staffEmail, 'Staff1234!');
    eventA = await createEvent(`sh-a-${stamp}`);
    eventB = await createEvent(`sh-b-${stamp}`);
    sharedId = await uploadTemplate(eventA, 'Compartida');
    // B con su propia default de ASISTENTE.
    const ownB = await uploadTemplate(eventB, 'Propia B');
    await api(`/api/v1/certificate-templates/${ownB}/set-default`, adminToken, { method: 'POST' });
    await api(`/api/v1/certificate-templates/${sharedId}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isShared: true }),
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `sh-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `sh-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('importar crea copia independiente', async () => {
    const res = await api(`/api/v1/events/${eventB}/certificate-templates/import`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTemplateId: sharedId }),
    });
    expect(res.status).toBe(201);
    const copy = (await res.json()) as {
      id: string;
      eventId: string;
      roleKind: string;
      filePath: string;
      nameBox: unknown;
      isDefault: boolean;
      isShared: boolean;
    };
    expect(copy.eventId).toBe(eventB);
    expect(copy.id).not.toBe(sharedId);
    expect(copy.isDefault).toBe(false);
    expect(copy.isShared).toBe(false);
    expect(copy.roleKind).toBe('ASISTENTE');
    const prisma = getPrisma();
    const source = await prisma.certificateTemplate.findUnique({ where: { id: sharedId } });
    expect(copy.filePath).toBe(source?.filePath);
    expect(JSON.stringify(copy.nameBox)).toBe(JSON.stringify(source?.nameBox));
  });

  it('la predeterminada de B no cambia tras importar', async () => {
    const prisma = getPrisma();
    const defaults = await prisma.certificateTemplate.findMany({
      where: { eventId: eventB, roleKind: 'ASISTENTE', isDefault: true },
    });
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).not.toBe(sharedId);
  });

  it('importar no compartida responde 404', async () => {
    const own = await uploadTemplate(eventA, 'Privada');
    const res = await api(`/api/v1/events/${eventB}/certificate-templates/import`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTemplateId: own }),
    });
    expect(res.status).toBe(404);
  });

  it('STAFF no importa ni lista compartidas', async () => {
    const imp = await api(`/api/v1/events/${eventB}/certificate-templates/import`, staffToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTemplateId: sharedId }),
    });
    expect(imp.status).toBe(403);
    const list = await api('/api/v1/certificate-templates/shared', staffToken);
    expect(list.status).toBe(403);
  });

  it('borrar la copia no rompe la original', async () => {
    const prisma = getPrisma();
    const copy = await prisma.certificateTemplate.findFirst({
      where: { eventId: eventB, name: 'Compartida' },
    });
    const del = await api(`/api/v1/certificate-templates/${copy!.id}`, adminToken, {
      method: 'DELETE',
    });
    expect(del.status).toBe(204);
    const source = await prisma.certificateTemplate.findUnique({ where: { id: sharedId } });
    expect(source?.id).toBe(sharedId);
    const file = await api(`/api/v1/certificate-templates/${sharedId}/file`, adminToken);
    expect(file.status).toBe(200);
  });
});
