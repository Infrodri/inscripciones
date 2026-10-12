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
let openEventId = '';
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

function registration(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Pérez',
    ci: `H2-${stamp}`,
    email: `h2-${stamp}@test.com`,
    type: 'PUBLICO',
    dataConsent: true,
    ...overrides,
  };
}

async function createOpenEvent(slug: string, capacity: number | null): Promise<string> {
  const created = (await (
    await api('/api/v1/events', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        slug,
        title: 'H2',
        eventKind: 'K',
        institution: 'I',
        organizer: 'O',
        location: 'L',
        capacity,
      }),
    })
  ).json()) as { id: string };
  await api(`/api/v1/events/${created.id}/publish`, adminToken, { method: 'POST' });
  return created.id;
}

describe('H2 inscripción pública', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `h2-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'H2', role: 'ADMIN' },
    });
    adminToken = (
      (await (
        await api('/api/v1/auth/login', null, {
          method: 'POST',
          body: JSON.stringify({ email, password: 'Admin1234!' }),
        })
      ).json()) as { token: string }
    ).token;
    openEventId = await createOpenEvent(`h2-abierto-${stamp}`, 20);
    void openEventId;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h2-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h2-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('rechaza inscripción en evento no abierto', async () => {
    const draft = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `h2-borrador-${stamp}`,
          title: 'H2',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    void draft;
    const res = await api(`/api/v1/public/events/h2-borrador-${stamp}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(registration()),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'REGISTRATION_CLOSED'
    );
  });

  it('rechaza duplicado por CI y por correo', async () => {
    const slug = `h2-dup-${stamp}`;
    await createOpenEvent(slug, null);
    const first = await api(`/api/v1/public/events/${slug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(registration()),
    });
    expect(first.status).toBe(201);
    const byCi = await api(`/api/v1/public/events/${slug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(registration({ email: `otro-${stamp}@test.com` })),
    });
    expect(byCi.status).toBe(409);
    const byEmail = await api(`/api/v1/public/events/${slug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify(registration({ ci: `OTRO-${stamp}` })),
    });
    expect(byEmail.status).toBe(409);
  });

  it('respeta el cupo con inscripciones concurrentes', async () => {
    const slug = `h2-cupo-${stamp}`;
    await createOpenEvent(slug, 1);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        api(`/api/v1/public/events/${slug}/registrations`, null, {
          method: 'POST',
          body: JSON.stringify(
            registration({ ci: `CUPO-${stamp}-${n}`, email: `cupo-${stamp}-${n}@test.com` })
          ),
        })
      )
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('la página pública no expone datos personales', async () => {
    const res = await api(`/api/v1/public/events/h2-abierto-${stamp}`, null);
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/passwordHash|qrToken|certificateCode/i);
  });

  it('el honeypot acepta sin crear nada', async () => {
    const slug = `h2-honey-${stamp}`;
    await createOpenEvent(slug, null);
    const res = await api(`/api/v1/public/events/${slug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({
        ...registration({ ci: `HON-${stamp}`, email: `hon-${stamp}@test.com` }),
        website: 'http://spam.com',
      }),
    });
    expect(res.status).toBe(201);
    const prisma = getPrisma();
    expect(await prisma.participant.count({ where: { ci: `HON-${stamp}` } })).toBe(0);
  });

  it('qr.png con token inválido responde INVALID_QR', async () => {
    const res = await api('/api/v1/public/registrations/token-inexistente/qr.png', null);
    expect(res.status).toBe(422);
  });
});
