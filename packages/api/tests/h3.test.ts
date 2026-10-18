import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const stamp = Date.now();
const s9 = String(stamp).slice(-9);
let baseUrl = '';
let adminToken = '';
let staffToken = '';
let server: Server | null = null;
let eventId = '';
let activeSessionId = '';
let futureSessionId = '';
let participantId = '';
let qrToken = '';

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe('H3 asistencia', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `h3-admin-${stamp}@test.com`;
    const staffEmail = `h3-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'H3',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'H3',
        role: 'STAFF',
      },
    });
    const login = async (email: string): Promise<string> =>
      (
        (await (
          await api('/api/v1/auth/login', null, {
            method: 'POST',
            body: JSON.stringify({
              email,
              password: email.includes('admin') ? 'Admin1234!' : 'Staff1234!',
            }),
          })
        ).json()) as { token: string }
      ).token;
    adminToken = await login(adminEmail);
    staffToken = await login(staffEmail);
    const event = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `h3-${stamp}`,
          title: 'H3',
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
    const participant = await prisma.participant.create({
      data: {
        eventId,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `H3${s9}`,
        email: `h3-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `h3-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
    participantId = participant.id;
    qrToken = participant.qrToken;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h3-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h3-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('registra check-in con QR dentro de la ventana', async () => {
    const res = await api(`/api/v1/sessions/${activeSessionId}/check-in`, staffToken, {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { firstName: string }).firstName).toBe('Ana');
  });

  it('el doble escaneo responde ALREADY_CHECKED_IN sin duplicar', async () => {
    const res = await api(`/api/v1/sessions/${activeSessionId}/check-in`, staffToken, {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'ALREADY_CHECKED_IN'
    );
    const prisma = getPrisma();
    expect(
      await prisma.attendance.count({ where: { participantId, sessionId: activeSessionId } })
    ).toBe(1);
  });

  it('fuera de ventana responde SESSION_NOT_ACTIVE', async () => {
    const res = await api(`/api/v1/sessions/${futureSessionId}/check-in`, staffToken, {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
    expect(res.status).toBe(422);
  });

  it('QR inválido responde INVALID_QR', async () => {
    const res = await api(`/api/v1/sessions/${activeSessionId}/check-in`, staffToken, {
      method: 'POST',
      body: JSON.stringify({ qrToken: 'qr-inexistente' }),
    });
    expect(res.status).toBe(422);
  });

  it('inscripción en puerta crea inscrito WALK_IN con asistencia', async () => {
    const res = await api(`/api/v1/events/${eventId}/participants`, staffToken, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Pedro',
        lastName: 'Soto',
        ci: `H3W${s9}`,
        email: `h3w-${stamp}@test.com`,
        type: 'PUBLICO',
        sessionId: activeSessionId,
      }),
    });
    expect(res.status).toBe(201);
    const prisma = getPrisma();
    const created = await prisma.participant.findFirst({ where: { eventId, ci: `H3W${s9}` } });
    expect(created?.source).toBe('WALK_IN');
  });

  it('anular exige ADMIN, motivo y deja auditoría', async () => {
    const prisma = getPrisma();
    const attendance = await prisma.attendance.findUnique({
      where: { participantId_sessionId: { participantId, sessionId: activeSessionId } },
    });
    const forbidden = await api(`/api/v1/attendances/${attendance!.id}/void`, staffToken, {
      method: 'POST',
      body: JSON.stringify({ reason: 'prueba' }),
    });
    expect(forbidden.status).toBe(403);
    const res = await api(`/api/v1/attendances/${attendance!.id}/void`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ reason: 'registro duplicado en puerta' }),
    });
    expect(res.status).toBe(200);
    expect(
      await prisma.auditLog.count({ where: { entity: 'attendance', entityId: attendance!.id } })
    ).toBe(1);
  });

  it('porcentaje con anuladas y aptos en stats', async () => {
    const res = await api(`/api/v1/events/${eventId}/stats`, staffToken);
    expect(res.status).toBe(200);
    const stats = (await res.json()) as {
      participants: number;
      sessions: number;
      eligible: number;
    };
    // Ana anulada (0/2), Pedro 1/2 → nadie llega al 80%.
    expect(stats.participants).toBe(2);
    expect(stats.sessions).toBe(2);
    expect(stats.eligible).toBe(0);
  });

  it('STAFF lee eventos y sesiones para la vista del escáner', async () => {
    const events = await api('/api/v1/events', staffToken);
    expect(events.status).toBe(200);
    const sessions = await api(`/api/v1/sessions/event/${eventId}`, staffToken);
    expect(sessions.status).toBe(200);
    expect(((await sessions.json()) as { data: unknown[] }).data.length).toBe(2);
  });
});
