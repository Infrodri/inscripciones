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

describe('H8 lista de asistencia', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const adminEmail = `h8-admin-${stamp}@test.com`;
    const staffEmail = `h8-staff-${stamp}@test.com`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'H8',
        role: 'ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'H8',
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
    const event = (await (
      await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          slug: `h8-${stamp}`,
          title: 'H8',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    await prisma.participant.create({
      data: {
        eventId,
        firstName: 'Ana',
        lastName: 'Pérez',
        ci: `H8${s9}`,
        email: `h8-${stamp}@test.com`,
        type: 'PUBLICO',
        qrToken: `h8-qr-${stamp}`,
        dataConsentAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `h8-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `h8-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('STAFF puede descargar la lista en PDF', async () => {
    const res = await fetch(`${baseUrl}/api/v1/events/${eventId}/exports/attendance-list.pdf`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(500);
  });

  it('sin auth responde 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/events/${eventId}/exports/attendance-list.pdf`);
    expect(res.status).toBe(401);
  });
});
