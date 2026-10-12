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
let eventId = '';
let sessionId = '';

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

describe('Pestañas del evento', () => {
  beforeAll(async () => {
    const env = parseEnv(process.env);
    const app = buildApp(env);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `tabs-admin-${stamp}@test.com`;
    const staffEmail = `tabs-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'T',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'T',
        role: 'STAFF',
      },
    });
    const login = async (email: string, password: string): Promise<string> =>
      (
        (await (
          await api('/api/v1/auth/login', null, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          })
        ).json()) as { token: string }
      ).token;
    adminToken = await login(adminEmail, 'Admin1234!');
    staffToken = await login(staffEmail, 'Staff1234!');
    const event = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `tabs-${stamp}`,
          title: 'Tabs',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    const session = (await (
      await api('/api/v1/sessions', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId, startsAt: new Date(Date.now() - 600_000).toISOString() }),
      })
    ).json()) as { id: string };
    sessionId = session.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `tabs-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `tabs-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('PATCH actualiza cupo y fecha límite', async () => {
    const res = await api(`/api/v1/events/${eventId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ capacity: 50 }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { capacity: number }).capacity).toBe(50);
  });

  it('PATCH rechaza cupo negativo', async () => {
    const res = await api(`/api/v1/events/${eventId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ capacity: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it('cerrar desde borrador falla; publicar, cerrar y reabrir funcionan', async () => {
    expect(
      (await api(`/api/v1/events/${eventId}/close`, adminToken, { method: 'POST' })).status
    ).toBe(400);
    expect(
      (await api(`/api/v1/events/${eventId}/publish`, adminToken, { method: 'POST' })).status
    ).toBe(200);
    expect(
      (await api(`/api/v1/events/${eventId}/reopen`, adminToken, { method: 'POST' })).status
    ).toBe(400);
    expect(
      (await api(`/api/v1/events/${eventId}/close`, adminToken, { method: 'POST' })).status
    ).toBe(200);
    const reopened = await api(`/api/v1/events/${eventId}/reopen`, adminToken, { method: 'POST' });
    expect(reopened.status).toBe(200);
    expect(((await reopened.json()) as { status: string }).status).toBe('ABIERTO');
  });

  it('STAFF ve la lista de quienes marcaron', async () => {
    const prisma = getPrisma();
    const participant = await prisma.participant.create({
      data: {
        eventId,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `TABS${String(stamp).slice(-9)}`,
        type: 'PUBLICO',
        qrToken: `tabs-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    await prisma.attendance.create({
      data: { participantId: participant.id, sessionId, method: 'QR' },
    });
    const res = await api(`/api/v1/sessions/${sessionId}/attendances`, staffToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ participant: { firstName: string }; method: string }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].participant.firstName).toBe('Ana');
    expect(body.data[0].method).toBe('QR');
  });
});
