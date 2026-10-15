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
let freeSlug = '';
let paidSlug = '';
let paidEventId = '';

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

describe('Pago de eventos: comprobantes y QR institucional', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `payment-admin-${stamp}@test.com`;

    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'PaymentAdmin',
        role: 'ADMIN',
      },
    });

    const loginRes = await api('/api/v1/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Admin1234!' }),
    });
    adminToken = ((await loginRes.json()) as { token: string }).token;

    // Crear evento gratis
    freeSlug = `pay-free-${stamp}`;
    const freeCreated = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: freeSlug,
          title: 'Evento Gratuito',
          eventKind: 'Conferencia',
          institution: 'Facultad',
          organizer: 'Organizador',
          location: 'Auditorio',
          isFree: true,
        }),
      })
    ).json()) as { id: string };
    await api(`/api/v1/events/${freeCreated.id}/publish`, adminToken, { method: 'POST' });

    // Crear evento de pago
    paidSlug = `pay-paid-${stamp}`;
    const paidCreated = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: paidSlug,
          title: 'Evento de Pago',
          eventKind: 'Taller',
          institution: 'Facultad',
          organizer: 'Organizador',
          location: 'Aula Magna',
          isFree: false,
          cost: 100,
        }),
      })
    ).json()) as { id: string };
    paidEventId = paidCreated.id;
    await api(`/api/v1/events/${paidEventId}/publish`, adminToken, { method: 'POST' });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.participant.deleteMany({
      where: { event: { slug: { in: [freeSlug, paidSlug] } } },
    });
    await prisma.event.deleteMany({ where: { slug: { in: [freeSlug, paidSlug] } } });
    await prisma.user.deleteMany({ where: { email: { contains: `payment-admin-${stamp}` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('evento gratis: la inscripción funciona sin comprobante', async () => {
    const res = await api(`/api/v1/public/events/${freeSlug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Carlos',
        lastName: 'Gómez',
        ci: '7788991',
        email: `free-${stamp}@test.com`,
        type: 'ESTUDIANTE',
        dataConsent: true,
      }),
    });
    expect(res.status).toBe(201);

    const prisma = getPrisma();
    const participant = await prisma.participant.findFirst({
      where: { email: `free-${stamp}@test.com` },
    });
    expect(participant).toBeTruthy();
    expect(participant?.paymentProofUrl).toBeNull();
  });

  it('evento de pago: inscripción sin paymentProofUrl responde 400', async () => {
    const res = await api(`/api/v1/public/events/${paidSlug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Lucía',
        lastName: 'Méndez',
        ci: '7788992',
        email: `paid-missing-${stamp}@test.com`,
        type: 'ESTUDIANTE',
        dataConsent: true,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('comprobante es obligatorio');
  });

  it('evento de pago con paymentProofUrl: responde 201 y se guarda', async () => {
    const proofUrl = 'http://localhost:3001/uploads/payment-proofs/test-proof.png';
    const res = await api(`/api/v1/public/events/${paidSlug}/registrations`, null, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Marcos',
        lastName: 'Rios',
        ci: '7788993',
        email: `paid-ok-${stamp}@test.com`,
        type: 'ESTUDIANTE',
        paymentProofUrl: proofUrl,
        dataConsent: true,
      }),
    });
    expect(res.status).toBe(201);

    const prisma = getPrisma();
    const participant = await prisma.participant.findFirst({
      where: { email: `paid-ok-${stamp}@test.com` },
    });
    expect(participant).toBeTruthy();
    expect(participant?.paymentProofUrl).toBe(proofUrl);
  });

  it('subida con mimetype no permitido responde error', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('texto plano no permitido')], { type: 'text/plain' }),
      'archivo.txt'
    );

    const res = await fetch(`${baseUrl}/api/v1/public/events/${paidSlug}/payment-proof`, {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNSUPPORTED_FILE');
  });

  it('subida de comprobante válida en evento de pago devuelve { url }', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('%PDF-1.4 simulado')], { type: 'application/pdf' }),
      'comprobante.pdf'
    );

    const res = await fetch(`${baseUrl}/api/v1/public/events/${paidSlug}/payment-proof`, {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBeTruthy();
    expect(body.url).toContain('/uploads/payment-proofs/');
  });

  it('subida de comprobante en evento gratuito responde error de validación', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('png data')], { type: 'image/png' }),
      'comprobante.png'
    );

    const res = await fetch(`${baseUrl}/api/v1/public/events/${freeSlug}/payment-proof`, {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('subida de QR institucional (admin) guarda y devuelve { url }', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('<svg></svg>')], { type: 'image/svg+xml' }),
      'qr.svg'
    );

    const res = await fetch(`${baseUrl}/api/v1/events/${paidEventId}/institution-qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBeTruthy();
    expect(body.url).toContain('/uploads/institution-qr/');

    const prisma = getPrisma();
    const event = await prisma.event.findUnique({ where: { id: paidEventId } });
    expect(event?.institutionQr).toBe(body.url);
  });

  it('subida de QR institucional con mimetype no permitido responde error', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('no permitido')], { type: 'application/pdf' }),
      'invalido.pdf'
    );

    const res = await fetch(`${baseUrl}/api/v1/events/${paidEventId}/institution-qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(422);
  });
});
