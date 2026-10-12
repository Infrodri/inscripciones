import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const stamp = Date.now();
let baseUrl = '';
let adminToken = '';
let staffToken = '';
let server: Server | null = null;
let eventId = '';

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await api('/api/v1/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

describe('H1 rutas con roles', () => {
  beforeAll(async () => {
    const env = parseEnv(process.env);
    const app = buildApp(env);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `h1-admin-${stamp}@test.com`;
    const staffEmail = `h1-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'H1',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'H1',
        role: 'STAFF',
      },
    });
    adminToken = await login(adminEmail, 'Admin1234!');
    staffToken = await login(staffEmail, 'Staff1234!');
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h1-${stamp}` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h1-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('GET /health sin auth responde 200 con BD', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('STAFF no puede crear eventos (403 FORBIDDEN)', async () => {
    const res = await api('/api/v1/events', staffToken, {
      method: 'POST',
      body: JSON.stringify({
        slug: `h1-${stamp}`,
        title: 'X',
        eventKind: 'K',
        institution: 'I',
        organizer: 'O',
        location: 'L',
      }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
  });

  it('ADMIN crea evento, sesión, expositor y auspiciante; y los actualiza', async () => {
    const slug = `h1-evento-${stamp}`;
    const created = await api('/api/v1/events', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        slug,
        title: 'Evento H1',
        eventKind: 'Conversatorio',
        institution: 'USFX',
        organizer: 'Facultad',
        location: 'Salón',
      }),
    });
    expect(created.status).toBe(201);
    const event = (await created.json()) as { id: string };
    eventId = event.id;
    const session = await (
      await api('/api/v1/sessions', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id, startsAt: '2026-10-12T18:00:00-04:00' }),
      })
    ).json();
    const speaker = await (
      await api('/api/v1/speakers', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id, fullName: 'Dr. Test', role: 'EXPOSITOR' }),
      })
    ).json();
    const sponsor = await (
      await api('/api/v1/sponsors', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id, name: 'Auspiciante' }),
      })
    ).json();
    for (const [path, id] of [
      ['/api/v1/sessions', (session as { id: string }).id],
      ['/api/v1/speakers', (speaker as { id: string }).id],
      ['/api/v1/sponsors', (sponsor as { id: string }).id],
    ] as Array<[string, string]>) {
      const res = await api(`${path}/${id}`, adminToken, {
        method: 'PUT',
        body: JSON.stringify({ position: 1 }),
      });
      expect(res.status).toBe(200);
    }
  });

  it('sube el afiche y guarda original + copia 1200px', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 10, g: 42, b: 94 } },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append('banner', new Blob([png], { type: 'image/png' }), 'afiche.png');
    const res = await fetch(`${baseUrl}/api/v1/events/${eventId}/banner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bannerPath: string; shareImagePath: string };
    expect(body.bannerPath).toContain(`banners/${eventId}/`);
    expect(body.shareImagePath).toContain(`banners/${eventId}/share-`);
  });

  it('duplicar copia datos pero no inscritos', async () => {
    const prisma = getPrisma();
    const source = await prisma.event.findFirst({ where: { slug: `h1-evento-${stamp}` } });
    await prisma.participant.create({
      data: {
        eventId: source!.id,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `H1-${stamp}`,
        email: `h1-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `h1-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    const res = await api(`/api/v1/events/${source!.id}/duplicate`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ title: 'Copia H1', slug: `h1-copia-${stamp}`, daysShift: 1 }),
    });
    expect(res.status).toBe(201);
    const copy = (await res.json()) as { id: string };
    expect(await prisma.participant.count({ where: { eventId: copy.id } })).toBe(0);
    expect(await prisma.speaker.count({ where: { eventId: copy.id } })).toBe(1);
    expect(await prisma.session.count({ where: { eventId: copy.id } })).toBe(1);
  });
});
