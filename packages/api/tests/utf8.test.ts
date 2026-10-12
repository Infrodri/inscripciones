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

// UTF-8 de punta a punta: tildes y ñ deben sobrevivir ida y vuelta.
describe('UTF-8', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `utf8-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'U', role: 'ADMIN' },
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
      await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          slug: `utf8-${stamp}`,
          title: 'Título con ñ y tildes: Evaluación',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'Salón Peñas',
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `utf8-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `utf8-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('etiqueta con tildes y ñ sobrevive ida y vuelta', async () => {
    const created = (await (
      await fetch(`${baseUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          eventId,
          startsAt: new Date().toISOString(),
          label: 'Jornada única ñ',
        }),
      })
    ).json()) as { id: string };
    const read = (await (
      await fetch(`${baseUrl}/api/v1/sessions/${created.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json()) as { label: string };
    expect(read.label).toBe('Jornada única ñ');
  });
});
