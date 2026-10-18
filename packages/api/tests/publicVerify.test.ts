import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';

const stamp = Date.now();
let baseUrl = '';
let server: Server | null = null;
let eventId = '';
let participantId = '';
const testCi = `1234567-${stamp}`;
const testCode = `cert-${stamp}-abc`;

describe('POST /api/v1/public/certificates/verify', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const prisma = getPrisma();
    const event = await prisma.event.create({
      data: {
        slug: `event-verify-${stamp}`,
        title: 'Congreso de Prueba Verificación',
        eventKind: 'Congreso',
        institution: 'Facultad de Derecho',
        organizer: 'USFX',
        location: 'Auditorio Central',
        issuesCertificate: true,
      },
    });
    eventId = event.id;

    await prisma.session.create({
      data: {
        eventId,
        startsAt: new Date('2026-11-20T14:00:00Z'),
        label: 'Sesión Inaugural',
      },
    });

    const participant = await prisma.participant.create({
      data: {
        eventId,
        firstName: 'Carlos Alberto',
        lastName: 'Pérez Gómez',
        ci: testCi,
        email: `carlos-${stamp}@test.com`,
        type: 'ESTUDIANTE',
        qrToken: `qr-${stamp}`,
        certificateCode: testCode,
        dataConsentAt: new Date(),
      },
    });
    participantId = participant.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.participant.deleteMany({ where: { eventId } });
    await prisma.session.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('devuelve 400 con body incompleto', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('devuelve valid: false si el código no existe', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: testCi, code: 'codigo-inexistente' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.message).toContain('No se encontró un certificado');
  });

  it('devuelve valid: false si el código existe pero el CI es incorrecto (anti-enumeración)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: '9999999-wrong', code: testCode }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.message).toContain('No se encontró un certificado');
  });

  it('devuelve valid: true y nombre abreviado cuando CI y código coinciden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: testCi, code: testCode }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.certificate).toBeDefined();
    expect(body.certificate.eventTitle).toBe('Congreso de Prueba Verificación');
    expect(body.certificate.recipientName).toBe('Carlos A. P. G.');
    expect(body.certificate.role).toBe('ASISTENTE');
  });
});
