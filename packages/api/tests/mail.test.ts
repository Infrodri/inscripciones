import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';
import { __setTestTransport } from '../src/application/certificateMail.js';

process.env.MAIL_DAILY_LIMIT = '4';
process.env.SMTP_HOST = 'test-smtp';

const stamp = Date.now();
let baseUrl = '';
let adminToken = '';
let server: Server | null = null;
let eventId = '';
const sent: Array<{ to: string; attachments: Array<{ content: Buffer }> }> = [];

function okTransport() {
  return {
    sendMail: async (mail: {
      to: string;
      attachments: Array<{ content: Buffer }>;
    }): Promise<void> => {
      sent.push({ to: mail.to, attachments: mail.attachments });
    },
  };
}

function flakyTransport() {
  return {
    sendMail: async (mail: {
      to: string;
      attachments: Array<{ content: Buffer }>;
    }): Promise<void> => {
      if (String(mail.to).includes('falla')) throw new Error('SMTP caído');
      sent.push({ to: mail.to, attachments: mail.attachments });
    },
  };
}

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers ?? {}) as Record<string, string>),
  };
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

const NAME_BOX = {
  xPct: 10,
  yPct: 45,
  wPct: 80,
  hPct: 12,
  fontKey: 'serif',
  sizePt: 48,
  color: '#000000',
  align: 'center',
  nameCase: 'AS_TYPED',
  autoShrink: true,
};

async function uploadTemplate(): Promise<void> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 2000, height: 1414, channels: 3, background: { r: 245, g: 245, b: 245 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'plantilla.png');
  form.append('name', 'Base');
  form.append('roleKind', 'ASISTENTE');
  form.append('nameBox', JSON.stringify(NAME_BOX));
  await api(`/api/v1/events/${eventId}/certificate-templates/upload`, adminToken, {
    method: 'POST',
    body: form,
  });
  const list = (await (
    await api(`/api/v1/events/${eventId}/certificate-templates`, adminToken)
  ).json()) as { data: Array<{ id: string }> };
  await api(`/api/v1/certificate-templates/${list.data[0].id}/set-default`, adminToken, {
    method: 'POST',
  });
}

async function addParticipant(ci: string, email: string | null): Promise<string> {
  const prisma = getPrisma();
  const p = await prisma.participant.create({
    data: {
      eventId,
      firstName: 'Ana',
      lastName: 'Pérez',
      ci,
      email,
      type: 'PUBLICO',
      qrToken: `mail-${ci}-${stamp}`,
      dataConsentAt: new Date(),
    },
  });
  return p.id;
}

async function attend(pid: string): Promise<void> {
  const prisma = getPrisma();
  const session = await prisma.session.findFirst({ where: { eventId } });
  await prisma.attendance.create({
    data: { participantId: pid, sessionId: session!.id, method: 'QR' },
  });
}

describe('Correo de certificados', () => {
  beforeAll(async () => {
    const app = buildApp(parseEnv(process.env));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const prisma = getPrisma();
    const email = `mail-admin-${stamp}@test.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword('Admin1234!'), name: 'M', role: 'ADMIN' },
    });
    adminToken = (
      (await (
        await api('/api/v1/auth/login', null, {
          method: 'POST',
          body: JSON.stringify({ email, password: 'Admin1234!' }),
        })
      ).json()) as { token: string }
    ).token;
    const event = (await (
      await api('/api/v1/events', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          slug: `mail-${stamp}`,
          title: 'M',
          eventKind: 'K',
          institution: 'I',
          organizer: 'O',
          location: 'L',
          emailCertificates: true,
        }),
      })
    ).json()) as { id: string };
    eventId = event.id;
    await prisma.session.create({ data: { eventId, startsAt: new Date(Date.now() - 600_000) } });
    await uploadTemplate();
    __setTestTransport(okTransport() as never);
  });

  afterAll(async () => {
    __setTestTransport(null);
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `mail-` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `mail-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('envío individual con adjunto PDF válido', async () => {
    const pid = await addParticipant(`MAILA${String(stamp).slice(-9)}`, `a-${stamp}@test.com`);
    await attend(pid);
    const res = await api(`/api/v1/participants/${pid}/send-certificate`, adminToken, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const prisma = getPrisma();
    const updated = await prisma.participant.findUnique({ where: { id: pid } });
    expect(updated?.certificateEmailedAt).not.toBeNull();
    const last = sent[sent.length - 1];
    expect(last.attachments[0].content.slice(0, 4).toString()).toBe('%PDF');
  });

  it('lote con un fallo no interrumpe y registra el error', async () => {
    __setTestTransport(flakyTransport() as never);
    const okId = await addParticipant(`MAILB${String(stamp).slice(-9)}`, `b-${stamp}@test.com`);
    const failId = await addParticipant(
      `MAILC${String(stamp).slice(-9)}`,
      `falla-${stamp}@test.com`
    );
    await attend(okId);
    await attend(failId);
    const res = await api(`/api/v1/events/${eventId}/send-certificates`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleKind: 'ASISTENTE', scope: 'all' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: number;
      failed: Array<{ id: string }>;
      done: boolean;
    };
    expect(body.sent).toBeGreaterThanOrEqual(1);
    expect(body.failed).toHaveLength(1);
    const prisma = getPrisma();
    const failed = await prisma.participant.findUnique({ where: { id: failId } });
    expect(failed?.certificateEmailedAt).toBeNull();
    expect(failed?.certificateEmailError).toMatch(/SMTP/);
    __setTestTransport(okTransport() as never);
  });

  it('reanudar no reenvía a los ya enviados', async () => {
    const res = await api(`/api/v1/events/${eventId}/send-certificates`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleKind: 'ASISTENTE', scope: 'all' }),
    });
    const body = (await res.json()) as { sent: number; pending: number; done: boolean };
    expect(body.sent).toBe(1);
    expect(body.done).toBe(true);
  });

  it('persona sin correo se omite', async () => {
    await addParticipant(`MAILD${String(stamp).slice(-9)}`, null);
    const res = await api(`/api/v1/events/${eventId}/send-certificates`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleKind: 'ASISTENTE', scope: 'all' }),
    });
    const body = (await res.json()) as { skippedNoEmail: number };
    expect(body.skippedNoEmail).toBeGreaterThanOrEqual(1);
  });

  it('límite diario detiene el envío', async () => {
    const prisma = getPrisma();
    // Simula 100 envíos hoy para agotar el límite de la prueba.
    const today = new Date();
    await prisma.participant.updateMany({
      where: { eventId },
      data: { certificateEmailedAt: today },
    });
    const res = await api(`/api/v1/events/${eventId}/send-certificates`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleKind: 'ASISTENTE', scope: 'all' }),
    });
    const body = (await res.json()) as { sent: number; limited: boolean };
    expect(res.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.limited).toBe(true);
  });

  it('probar envío manda la muestra', async () => {
    const res = await api(`/api/v1/events/${eventId}/test-certificate-email`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `muestra-${stamp}@test.com` }),
    });
    expect(res.status).toBe(200);
  });
});
