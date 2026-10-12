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

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe('B2 campos configurables y QR del enlace', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `b2-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'B2',
        role: 'ADMIN',
      },
    });
    adminToken = (
      (await (
        await api('/api/v1/auth/login', null, {
          method: 'POST',
          body: JSON.stringify({ email, password: 'Admin1234!' }),
        })
      ).json()) as { token: string }
    ).token;
    const created = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `b2-${stamp}`,
          title: 'B2',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
          requireCareer: true,
        }),
      })
    ).json()) as { id: string };
    await api(`/api/v1/events/${created.id}/publish`, adminToken, { method: 'POST' });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `b2-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `b2-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('exige la carrera cuando el evento la requiere', async () => {
    const base = {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: `b2-${stamp}@test.com`,
      type: 'PUBLICO',
      dataConsent: true,
    };
    const missing = await api(`/api/v1/public/events/b2-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({ ...base, ci: `B2A-${stamp}` }),
    });
    expect(missing.status).toBe(400);
    const ok = await api(`/api/v1/public/events/b2-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({ ...base, ci: `B2B-${stamp}`, career: 'Derecho' }),
    });
    expect(ok.status).toBe(201);
  });

  it('la vista pública expone los flags', async () => {
    const res = await api(`/api/v1/public/events/b2-${stamp}`, null);
    expect(((await res.json()) as { requireCareer: boolean }).requireCareer).toBe(true);
  });

  it('QR del enlace en PNG', async () => {
    const res = await api(`/api/v1/public/events/b2-${stamp}/link-qr.png`, null);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const missing = await api('/api/v1/public/events/no-existe/link-qr.png', null);
    expect(missing.status).toBe(404);
  });

  it('guarda normalizado y aparece en la lista del admin', async () => {
    const res = await api(`/api/v1/public/events/b2-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({
        firstName: '  María  Eugenia ',
        lastName: 'Santiváñez ',
        ci: ` B2N-${stamp} `,
        email: `B2N-${stamp}@TEST.COM`,
        type: 'ESTUDIANTE',
        career: 'Derecho',
        dataConsent: true,
      }),
    });
    expect(res.status).toBe(201);
    const prisma = getPrisma();
    const stored = await prisma.participant.findFirst({ where: { ci: `B2N-${stamp}` } });
    expect(stored?.firstName).toBe('María Eugenia');
    expect(stored?.email).toBe(`b2n-${stamp}@test.com`);
    const list = (await (
      await api(`/api/v1/participants/event/${stored?.eventId}`, adminToken)
    ).json()) as { data: Array<{ ci: string }> };
    expect(list.data.some((p) => p.ci === `B2N-${stamp}`)).toBe(true);
  });
});
