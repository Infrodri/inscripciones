import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';
import { normalizePhone } from '../src/shared/normalize.js';

const stamp = Date.now();
const s9 = String(stamp).slice(-9);
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

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Pérez',
    ci: `AB${s9}`,
    type: 'ESTUDIANTE',
    dataConsent: true,
    ...overrides,
  };
}

describe('Bloque A formulario rápido', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `ab-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'AB',
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
          slug: `ab-${stamp}`,
          title: 'AB',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    await api(`/api/v1/events/${created.id}/publish`, adminToken, { method: 'POST' });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `ab-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `ab-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('CI vacío responde 400', async () => {
    const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(baseRegistration({ ci: '   ' })),
    });
    expect(res.status).toBe(400);
  });

  it('nombre vacío responde 400', async () => {
    const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(baseRegistration({ ci: `AB1${s9}`, firstName: '  ' })),
    });
    expect(res.status).toBe(400);
  });

  it('inscripción sin correo ni celular guarda nulos', async () => {
    const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(baseRegistration({ ci: `AB2${s9}` })),
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { notice: string }).notice).toMatch(/No indicaste correo/);
    const prisma = getPrisma();
    const stored = await prisma.participant.findFirst({ where: { ci: `AB2${s9}` } });
    expect(stored?.email).toBeNull();
    expect(stored?.phone).toBeNull();
  });

  it('dos inscritos sin correo en el mismo evento no colisionan', async () => {
    for (const ci of [`AB3${s9}`, `AB4${s9}`]) {
      const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
        method: 'POST',
        body: JSON.stringify(baseRegistration({ ci })),
      });
      expect(res.status).toBe(201);
    }
  });

  it('duplicado de CI responde 409', async () => {
    const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(baseRegistration({ ci: `AB2${s9}` })),
    });
    expect(res.status).toBe(409);
  });

  it('celular en varios formatos normaliza a +591XXXXXXXX', () => {
    expect(normalizePhone('+591 677-12345')).toBe('+59167712345');
    expect(normalizePhone('59167712345')).toBe('+59167712345');
    expect(normalizePhone('677 12345')).toBe('+59167712345');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('celular inválido responde 400', async () => {
    const res = await api(`/api/v1/public/events/ab-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(baseRegistration({ ci: `AB5${s9}`, phone: '51234567' })),
    });
    expect(res.status).toBe(400);
  });
});
