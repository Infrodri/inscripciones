import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import {
  issueSelfCheckinToken,
  verifySelfCheckinToken,
  SELF_CHECKIN_WINDOW_SECONDS,
} from '../src/application/selfCheckin.js';

const stamp = Date.now();
let baseUrl = '';
let server: Server | null = null;
const env = parseEnv(process.env);

let adminUserId = '';
let staff1Id = '';
let staff2Id = '';
let adminToken = '';
let staff1Token = '';
let staff2Token = '';

let eventStaff1Id = '';
let sessionId = '';

describe('Auditoría Integral de Seguridad y Control de Acceso (IDOR, Roles, Rate-Limit y Verificación)', () => {
  beforeAll(async () => {
    const app = buildApp(env);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const prisma = getPrisma();
    // 0. Crear usuarios en BD
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-${stamp}@test.com`,
        passwordHash: 'dummy',
        name: 'Admin Test',
        role: 'ADMIN',
      },
    });
    adminUserId = adminUser.id;
    adminToken = jwt.sign(
      { sub: adminUser.id, role: 'ADMIN', email: adminUser.email },
      env.JWT_SECRET
    );

    const staff1User = await prisma.user.create({
      data: {
        email: `staff1-${stamp}@test.com`,
        passwordHash: 'dummy',
        name: 'Staff 1',
        role: 'STAFF',
      },
    });
    staff1Id = staff1User.id;
    staff1Token = jwt.sign(
      { sub: staff1User.id, role: 'STAFF', email: staff1User.email },
      env.JWT_SECRET
    );

    const staff2User = await prisma.user.create({
      data: {
        email: `staff2-${stamp}@test.com`,
        passwordHash: 'dummy',
        name: 'Staff 2',
        role: 'STAFF',
      },
    });
    staff2Id = staff2User.id;
    staff2Token = jwt.sign(
      { sub: staff2User.id, role: 'STAFF', email: staff2User.email },
      env.JWT_SECRET
    );

    // 1. Crear evento de Staff 1
    const event = await prisma.event.create({
      data: {
        slug: `event-staff1-${stamp}`,
        title: 'Evento Privado de Staff 1',
        eventKind: 'Seminario',
        institution: 'Facultad de Derecho',
        organizer: 'Staff 1 Organizer',
        location: 'Aula Magna',
        issuesCertificate: true,
        createdBy: staff1Id,
      },
    });
    eventStaff1Id = event.id;

    // 2. Crear sesión
    const session = await prisma.session.create({
      data: {
        eventId: eventStaff1Id,
        startsAt: new Date('2026-11-20T10:00:00Z'),
        label: 'Sesión Mañana',
      },
    });
    sessionId = session.id;

    // 3. Crear speaker
    await prisma.speaker.create({
      data: {
        eventId: eventStaff1Id,
        fullName: 'Dr. Expositor Uno',
        role: 'EXPOSITOR',
      },
    });

    // 4. Crear sponsor
    await prisma.sponsor.create({
      data: {
        eventId: eventStaff1Id,
        name: 'Auspiciador Uno',
      },
    });

    // 5. Crear participante
    await prisma.participant.create({
      data: {
        eventId: eventStaff1Id,
        firstName: 'Juan',
        lastName: 'Pérez',
        ci: `ci-${stamp}`,
        email: `juan-${stamp}@test.com`,
        type: 'ESTUDIANTE',
        qrToken: `qr-staff1-${stamp}`,
        certificateCode: `code-${stamp}-1`,
        dataConsentAt: new Date(),
      },
    });

    // 6. Crear plantilla de certificado
    const template = await prisma.certificateTemplate.create({
      data: {
        eventId: eventStaff1Id,
        roleKind: 'ASISTENTE',
        name: 'Plantilla Asistente Staff 1',
        filePath: `templates/${eventStaff1Id}/test.jpg`,
        widthPx: 1920,
        heightPx: 1080,
        pageWidthMm: 297,
        pageHeightMm: 210,
        nameBox: {
          xPct: 10,
          yPct: 40,
          wPct: 80,
          hPct: 15,
          fontKey: 'sans',
          sizePt: 36,
          color: '#0A2A5E',
          align: 'center',
          nameCase: 'UPPER',
          autoShrink: true,
        },
      },
    });

    // 7. Crear receptor manual
    await prisma.certificateRecipient.create({
      data: {
        eventId: eventStaff1Id,
        templateId: template.id,
        roleKind: 'EXPOSITOR',
        fullName: 'Dr. Expositor Uno',
        certificateCode: `recip-${stamp}-1`,
      },
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.attendance.deleteMany({ where: { session: { eventId: eventStaff1Id } } });
    await prisma.certificateRecipient.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.certificateTemplate.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.participant.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.session.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.speaker.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.sponsor.deleteMany({ where: { eventId: eventStaff1Id } });
    await prisma.event.deleteMany({ where: { id: eventStaff1Id } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, staff1Id, staff2Id] } },
    });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  // ==========================================
  // 1. STAFF IDOR: 8 endpoints verificados
  // ==========================================
  describe('STAFF IDOR Isolation (Staff 2 intentando acceder a recursos de Staff 1)', () => {
    it('1. GET /events/:id rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('2. GET /participants/event/:id rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/participants/event/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('3. GET /events/:id/exports/participants rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}/exports/participants`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('4. GET /sessions/event/:id rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sessions/event/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('5. GET /speakers/event/:id rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/speakers/event/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('6. GET /sponsors/event/:id rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sponsors/event/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('7. GET /events/:id/certificate-templates rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}/certificate-templates`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('8. GET /events/:id/certificate-recipients rechaza con 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}/certificate-recipients`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('Staff 1 (creador) SÍ puede acceder a sus propios recursos', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${staff1Token}` },
      });
      expect(res.status).toBe(200);
    });

    it('ADMIN puede acceder a los recursos de cualquier staff', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events/${eventStaff1Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // 2. Roles: ADMIN vs STAFF en /users
  // ==========================================
  describe('Control de Roles en /users', () => {
    it('ADMIN tiene acceso a /users (200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('STAFF es rechazado en /users con 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${staff1Token}` },
      });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 3. Verificación Pública: Uniformidad, Rate-Limit y Benchmark de Tiempo (N >= 50)
  // ==========================================
  describe('Verificación Pública de Certificados', () => {
    it('Respuesta uniforme idéntica entre CI inexistente y Código erróneo', async () => {
      const resMissingCi = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-rate-limit': '1',
        },
        body: JSON.stringify({ ci: 'ci-no-existe-999', code: `code-${stamp}-1` }),
      });
      const resWrongCode = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-rate-limit': '1',
        },
        body: JSON.stringify({ ci: `ci-${stamp}`, code: 'codigo-falso-999' }),
      });

      expect(resMissingCi.status).toBe(200);
      expect(resWrongCode.status).toBe(200);

      const bodyMissingCi = await resMissingCi.json();
      const bodyWrongCode = await resWrongCode.json();

      expect(bodyMissingCi).toEqual(bodyWrongCode);
      expect(bodyMissingCi).toEqual({
        valid: false,
        message: 'No se encontró un certificado válido con los datos proporcionados',
      });
    });

    it('Rate limiting: la 11ª solicitud sin bypass recibe HTTP 429 TOO_MANY_REQUESTS', async () => {
      const results: number[] = [];
      // Se ejecutan 11 solicitudes seguidas desde la misma IP sin header de bypass
      for (let i = 0; i < 11; i++) {
        const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ci: 'ci-test', code: 'code-test' }),
        });
        results.push(res.status);
      }
      // Las primeras 10 fueron aceptadas (200 con valid: false), la 11ª es 429
      expect(results.slice(0, 10)).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 200]);
      expect(results[10]).toBe(429);
    });

    it('Medición de tiempos de respuesta uniforme (N = 50) con media y desviación estándar', async () => {
      const N = 50;
      const durations: number[] = [];

      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/api/v1/public/certificates/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-bypass-rate-limit': '1',
          },
          body: JSON.stringify({
            ci: i % 2 === 0 ? 'ci-inexistente' : `ci-${stamp}`,
            code: i % 2 === 0 ? `code-${stamp}-1` : 'code-inexistente',
          }),
        });
        durations.push(performance.now() - t0);
        expect(res.status).toBe(200);
      }

      const mean = durations.reduce((a, b) => a + b, 0) / N;
      const variance = durations.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / N;
      const stdDev = Math.sqrt(variance);

      // Reportar métricas
      // eslint-disable-next-line no-console
      console.log(
        `[Timing Benchmark N=${N}] Media: ${mean.toFixed(2)}ms, Desv. Estándar: ${stdDev.toFixed(2)}ms`
      );

      expect(durations.length).toBe(N);
      expect(mean).toBeGreaterThan(100); // El padding uniforme calibrado es ~120-170ms
      expect(mean).toBeLessThan(350);
    }, 20_000);
  });

  // ==========================================
  // 4. Token de Autoasistencia: Expiración 45s y Aislamiento entre Sesiones
  // ==========================================
  describe('Tokens de Autoasistencia (/a/[token])', () => {
    it('Token vigente de la ventana actual es verificado exitosamente', () => {
      const now = Date.now();
      const token = issueSelfCheckinToken(env.JWT_SECRET, sessionId, now);
      const verified = verifySelfCheckinToken(env.JWT_SECRET, token, now);
      expect(verified).not.toBeNull();
      expect(verified?.sessionId).toBe(sessionId);
    });

    it('Token expirado (> 45s / más de 2 ventanas en el pasado) es rechazado (retorna null)', () => {
      const now = Date.now();
      // Emitido hace 3 ventanas en el pasado (> 135 segundos)
      const pastTime = now - 3 * SELF_CHECKIN_WINDOW_SECONDS * 1000;
      const expiredToken = issueSelfCheckinToken(env.JWT_SECRET, sessionId, pastTime);
      const verified = verifySelfCheckinToken(env.JWT_SECRET, expiredToken, now);
      expect(verified).toBeNull();
    });

    it('Protección contra reutilización entre sesiones (el HMAC incluye sessionId)', () => {
      const now = Date.now();
      const tokenSessionA = issueSelfCheckinToken(env.JWT_SECRET, sessionId, now);
      const otherSessionId = '00000000-0000-0000-0000-000000000099';

      // Al verificar el token de la sesión A, el ID retornado es sessionId y no otherSessionId
      const verified = verifySelfCheckinToken(env.JWT_SECRET, tokenSessionA, now);
      expect(verified?.sessionId).toBe(sessionId);
      expect(verified?.sessionId).not.toBe(otherSessionId);

      // Si un atacante intenta alterar el token para apuntar a otherSessionId, la firma HMAC falla
      const decoded = Buffer.from(tokenSessionA, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      parts[0] = otherSessionId;
      const forgedToken = Buffer.from(parts.join(':'), 'utf8').toString('base64url');

      const verifiedForged = verifySelfCheckinToken(env.JWT_SECRET, forgedToken, now);
      expect(verifiedForged).toBeNull();
    });
  });
});
