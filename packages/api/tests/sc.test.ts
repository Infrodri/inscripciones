import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';
import { issueSelfCheckinToken } from '../src/application/selfCheckin.js';

const stamp = Date.now();
const s9 = String(stamp).slice(-9);
let baseUrl = '';
let adminToken = '';
let staffToken = '';
let server: Server | null = null;
let eventId = '';
let activeSessionId = '';
let futureSessionId = '';
let secret = '';

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe('Bloque B QR de sala', () => {
  beforeAll(async () => {
    const env = parseEnv(process.env);
    secret = env.JWT_SECRET;
    const app = buildApp(env);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `sc-admin-${stamp}@test.com`;
    const staffEmail = `sc-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'SC',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'SC',
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
          slug: `sc-${stamp}`,
          title: 'SC',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    const staffUser = await prisma.user.findUnique({ where: { email: staffEmail } });
    if (staffUser) {
      await prisma.eventStaff.create({
        data: { eventId, userId: staffUser.id, accessLevel: 'OPERATOR' },
      });
    }
    const now = Date.now();
    const active = (await (
      await api('/api/v1/sessions', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId, startsAt: new Date(now - 10 * 60_000).toISOString() }),
      })
    ).json()) as { id: string };
    const future = (await (
      await api('/api/v1/sessions', adminToken, {
        method: 'POST',
        body: JSON.stringify({ eventId, startsAt: new Date(now + 5 * 3_600_000).toISOString() }),
      })
    ).json()) as { id: string };
    activeSessionId = active.id;
    futureSessionId = future.id;
    await prisma.participant.create({
      data: {
        eventId,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `SC${s9}`,
        email: `sc-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `sc-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    await api(`/api/v1/sessions/${activeSessionId}/self-checkin/open`, staffToken, {
      method: 'POST',
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `sc-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `sc-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('token vigente registra con SELF_QR y sin PII', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.firstName).toBe('Ana');
    expect(body.lastInitial).toBe('P.');
    expect(body).not.toHaveProperty('ci');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('phone');
    const prisma = getPrisma();
    const participant = await prisma.participant.findFirst({ where: { eventId, ci: `SC${s9}` } });
    const attendance = await prisma.attendance.findUnique({
      where: {
        participantId_sessionId: { participantId: participant!.id, sessionId: activeSessionId },
      },
    });
    expect(attendance?.method).toBe('SELF_QR');
  });

  it('token vencido responde INVALID_QR', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId, Date.now() - 120_000);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(422);
  });

  it('token de otra sesión responde INVALID_QR', async () => {
    const token = issueSelfCheckinToken(secret, '00000000-0000-0000-0000-000000000000');
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(422);
  });

  it('token manipulado responde INVALID_QR', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const tampered = token.slice(0, 10) + (token[10] === 'a' ? 'b' : 'a') + token.slice(11);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token: tampered, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(422);
  });

  it('registro cerrado responde SESSION_NOT_ACTIVE', async () => {
    await api(`/api/v1/sessions/${futureSessionId}/self-checkin/open`, staffToken, {
      method: 'POST',
    });
    await api(`/api/v1/sessions/${futureSessionId}/self-checkin/close`, staffToken, {
      method: 'POST',
    });
    const token = issueSelfCheckinToken(secret, futureSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(422);
  });

  it('CI no inscrito responde NOT_ENROLLED', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: 'ZZ99999999' }),
    });
    expect(res.status).toBe(404);
  });

  it('CI de otro evento responde NOT_ENROLLED', async () => {
    const other = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `sc-other-${stamp}`,
          title: 'SC',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    const prisma = getPrisma();
    await prisma.participant.create({
      data: {
        eventId: other.id,
        firstName: 'Pedro',
        lastName: 'Soto',
        ci: `SCX${s9}`,
        type: 'PUBLICO',
        qrToken: `scx-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SCX${s9}` }),
    });
    expect(res.status).toBe(404);
    await prisma.event.delete({ where: { id: other.id } });
  });

  it('doble registro responde ALREADY_CHECKED_IN', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(409);
  });

  it('fuera de ventana responde SESSION_NOT_ACTIVE', async () => {
    await api(`/api/v1/sessions/${futureSessionId}/self-checkin/open`, staffToken, {
      method: 'POST',
    });
    const token = issueSelfCheckinToken(secret, futureSessionId);
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SC${s9}` }),
    });
    expect(res.status).toBe(422);
    await api(`/api/v1/sessions/${futureSessionId}/self-checkin/close`, staffToken, {
      method: 'POST',
    });
  });

  it('5 fallos por CI bloquean el sexto (429)', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    for (let i = 0; i < 5; i += 1) {
      await api('/api/v1/public/self-checkin', null, {
        method: 'POST',
        body: JSON.stringify({ token, ci: 'ZZ00000001' }),
      });
    }
    const res = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: 'ZZ00000001' }),
    });
    expect(res.status).toBe(429);
  });

  it('porcentaje mezcla SELF_QR y QR', async () => {
    const prisma = getPrisma();
    const staffUser = await prisma.user.findFirst({
      where: { email: `sc-staff-${stamp}@test.com` },
    });
    const event = await prisma.event.create({
      data: {
        slug: `sc-mix-${stamp}`,
        title: 'SC',
        eventKind: 'K',
        institution: 'I',
        organizer: 'O',
        location: 'L',
        minAttendancePercent: 80,
        ...(staffUser
          ? {
              staffAssignments: {
                create: { userId: staffUser.id, accessLevel: 'OPERATOR' },
              },
            }
          : {}),
      },
    });
    const session = await prisma.session.create({
      data: { eventId: event.id, startsAt: new Date(Date.now() - 600_000) },
    });
    const p1 = await prisma.participant.create({
      data: {
        eventId: event.id,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `SCM1${s9}`,
        type: 'PUBLICO',
        qrToken: `scm1-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    const p2 = await prisma.participant.create({
      data: {
        eventId: event.id,
        firstName: 'Pedro',
        lastName: 'Soto',
        ci: `SCM2${s9}`,
        type: 'PUBLICO',
        qrToken: `scm2-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    await api(`/api/v1/sessions/${session.id}/self-checkin/open`, staffToken, { method: 'POST' });
    const token = issueSelfCheckinToken(secret, session.id);
    const selfRes = await api('/api/v1/public/self-checkin', null, {
      method: 'POST',
      body: JSON.stringify({ token, ci: `SCM1${s9}` }),
    });
    expect(selfRes.status).toBe(201);
    // Simula escaneo del staff (misma sesión, método QR).
    await prisma.attendance.create({
      data: { participantId: p2.id, sessionId: session.id, method: 'QR' },
    });
    const stats = (await (await api(`/api/v1/events/${event.id}/stats`, staffToken)).json()) as {
      eligible: number;
    };
    expect(stats.eligible).toBe(2);
    void p1;
    await prisma.event.delete({ where: { id: event.id } });
  });

  it('GET info pública solo expone título y horario', async () => {
    const token = issueSelfCheckinToken(secret, activeSessionId);
    const res = await api(`/api/v1/public/self-checkin/${token}`, null);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe('SC');
    expect(body.startsAt).toBeDefined();
    expect(body).not.toHaveProperty('participants');
    expect(body).not.toHaveProperty('qrToken');
  });
});
