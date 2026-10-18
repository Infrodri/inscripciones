import { Router } from 'express';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { renderCertificates, type CertificateJob } from '@inscripciones/infrastructure/pdf.js';
import { fontPaths } from '../../shared/fonts.js';
import { formatPrintedName } from '../../domain/nameFormat.js';
import { attendancePercentage } from '../../application/attendanceService.js';
import { defaultCertificateBody, sendCertificateMail } from '../../application/certificateMail.js';
import { logger } from '../../shared/logger.js';
import type { AppEnv } from '../env.js';
import { assertEventAccess } from '../../application/accessControl.js';

const admin = requireRole('ADMIN', 'STAFF');
const BATCH_SIZE = 20;

type NameBox = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  fontKey: 'sans' | 'serif' | 'script';
  sizePt: number;
  color: string;
  align: 'left' | 'center' | 'right';
  nameCase: 'UPPER' | 'TITLE' | 'AS_TYPED';
  autoShrink: true;
};

function dailyLimit(env: AppEnv): number {
  const parsed = Number(env.MAIL_DAILY_LIMIT ?? 300);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 300;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function renderOnePdf(
  privateStorage: { read: (key: string) => Promise<Buffer> },
  template: {
    filePath: string;
    widthPx: number;
    pageWidthMm: number;
    pageHeightMm: number;
    nameBox: unknown;
  },
  printedName: string
): Promise<Buffer> {
  const image = await privateStorage.read(template.filePath);
  const nameBox = template.nameBox as unknown as NameBox;
  const job: CertificateJob = {
    image,
    widthPx: template.widthPx,
    pageWidthMm: template.pageWidthMm,
    pageHeightMm: template.pageHeightMm,
    name: formatPrintedName(printedName, nameBox.nameCase),
    nameBox,
  };
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    out.on('end', () => resolve());
    out.on('error', (err: unknown) => reject(err));
  });
  const report = await renderCertificates([job], fontPaths(), out);
  await done;
  if (report.overflow.length > 0) {
    logger.warn('certificate_name_overflow', { names: report.overflow });
  }
  return Buffer.concat(chunks);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function certificateMailRoutes(
  env: AppEnv,
  privateStorage: { read: (key: string) => Promise<Buffer> }
): Router {
  const router = Router();

  function requireSmtp(): void {
    if (!env.SMTP_HOST) {
      throw new DomainError('VALIDATION_ERROR', 'Correo no configurado en el servidor');
    }
  }

  async function emailedToday(eventId: string): Promise<number> {
    const prisma = getPrisma();
    const since = startOfTodayUtc();
    const [a, b] = await Promise.all([
      prisma.participant.count({ where: { eventId, certificateEmailedAt: { gte: since } } }),
      prisma.certificateRecipient.count({
        where: { eventId, certificateEmailedAt: { gte: since } },
      }),
    ]);
    return a + b;
  }

  function mailTexts(
    event: {
      title: string;
      sessions: Array<{ startsAt: Date }>;
      certificateEmailSubject: string | null;
      certificateEmailBody: string | null;
    },
    templateName: string,
    personName: string
  ): { subject: string; text: string } {
    const first = [...event.sessions].sort((x, y) => (x.startsAt < y.startsAt ? -1 : 1))[0];
    const date = first
      ? new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'long' }).format(
          first.startsAt
        )
      : '';
    const fill = (template: string): string =>
      template
        .replaceAll('{nombre}', personName)
        .replaceAll('{evento}', event.title)
        .replaceAll('{fecha}', date)
        .replaceAll('{plantilla}', templateName);
    return {
      subject: event.certificateEmailSubject
        ? fill(event.certificateEmailSubject)
        : `Certificado: ${templateName} — ${event.title}`,
      text: event.certificateEmailBody
        ? fill(event.certificateEmailBody)
        : defaultCertificateBody(event.title, date),
    };
  }

  // Envío individual a un inscrito.
  router.post('/participants/:id/send-certificate', admin, async (req: AuthRequest, res, next) => {
    try {
      requireSmtp();
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({
        where: { id: req.params.id },
        include: { event: { include: { sessions: true } } },
      });
      if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
      await assertEventAccess(prisma, req.user, participant.eventId, 'MANAGER');
      if (!participant.email) throw new DomainError('VALIDATION_ERROR', 'Sin correo');
      const template = await prisma.certificateTemplate.findFirst({
        where: { eventId: participant.eventId, roleKind: 'ASISTENTE', isDefault: true },
      });
      if (!template)
        throw new DomainError(
          'NO_DEFAULT_TEMPLATE',
          'No hay plantilla predeterminada para ASISTENTE'
        );
      const pdf = await renderOnePdf(
        privateStorage,
        template,
        `${participant.firstName} ${participant.lastName}`
      );
      const texts = mailTexts(
        participant.event,
        template.name,
        `${participant.firstName} ${participant.lastName}`
      );
      try {
        await sendCertificateMail(env, {
          to: participant.email,
          subject: texts.subject,
          text: texts.text,
          pdf,
          filename: 'certificado.pdf',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fallo el envío';
        await prisma.participant.update({
          where: { id: participant.id },
          data: { certificateEmailError: message.slice(0, 200) },
        });
        throw new DomainError('VALIDATION_ERROR', `Falló: ${message.slice(0, 120)}`);
      }
      await prisma.participant.update({
        where: { id: participant.id },
        data: { certificateEmailedAt: new Date(), certificateEmailError: null },
      });
      res.json({ sent: participant.email });
    } catch (err) {
      next(err);
    }
  });

  // Envío individual a un receptor manual (usa el correo guardado).
  router.post(
    '/certificate-recipients/:id/send-certificate',
    admin,
    async (req: AuthRequest, res, next) => {
      try {
        requireSmtp();
        const prisma = getPrisma();
        const recipient = await prisma.certificateRecipient.findUnique({
          where: { id: req.params.id },
          include: { template: true, event: { include: { sessions: true } } },
        });
        if (!recipient) throw new DomainError('NOT_FOUND', 'Receptor no encontrado');
        await assertEventAccess(prisma, req.user, recipient.eventId, 'MANAGER');
        if (!recipient.email) throw new DomainError('VALIDATION_ERROR', 'Sin correo');
        const pdf = await renderOnePdf(privateStorage, recipient.template, recipient.fullName);
        const texts = mailTexts(recipient.event, recipient.template.name, recipient.fullName);
        try {
          await sendCertificateMail(env, {
            to: recipient.email,
            subject: texts.subject,
            text: texts.text,
            pdf,
            filename: 'certificado.pdf',
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Fallo el envío';
          await prisma.certificateRecipient.update({
            where: { id: recipient.id },
            data: { certificateEmailError: message.slice(0, 200) },
          });
          throw new DomainError('VALIDATION_ERROR', `Falló: ${message.slice(0, 120)}`);
        }
        await prisma.certificateRecipient.update({
          where: { id: recipient.id },
          data: { certificateEmailedAt: new Date(), certificateEmailError: null },
        });
        res.json({ sent: recipient.email });
      } catch (err) {
        next(err);
      }
    }
  );

  // Envío masivo por lotes de 20. La pantalla encadena con offset.
  router.post(
    '/events/:id/send-certificates',
    admin,
    validateBody(
      z.object({
        roleKind: z.enum(['ASISTENTE', 'EXPOSITOR', 'ORGANIZADOR', 'OTRO']),
        scope: z.enum(['eligible', 'all', 'selected']).default('eligible'),
        templateId: z.string().uuid().optional(),
        ids: z.array(z.string().uuid()).optional(),
        offset: z.number().int().min(0).default(0),
      })
    ),
    async (req: AuthRequest, res, next) => {
      try {
        requireSmtp();
        const prisma = getPrisma();
        const event = await assertEventAccess(prisma, req.user, req.params.id, 'MANAGER');
        const sessions = await prisma.session.findMany({ where: { eventId: event.id } });
        const eventWithSessions = { ...event, sessions };
        if (!event.emailCertificates) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Habilite el envío de certificados en el evento'
          );
        }
        const limit = dailyLimit(env);
        const sentToday = await emailedToday(event.id);
        if (sentToday >= limit) {
          const pendingAll = await countPending();
          res.json({
            sent: 0,
            failed: [],
            skippedNoEmail: 0,
            skippedSent: 0,
            pending: pendingAll,
            done: true,
            limited: true,
          });
          return;
        }
        const remaining = limit - sentToday;

        async function countPending(): Promise<number> {
          if (req.body.roleKind === 'ASISTENTE') {
            return prisma.participant.count({
              where: { eventId: event!.id, certificateEmailedAt: null },
            });
          }
          return prisma.certificateRecipient.count({
            where: { eventId: event!.id, certificateEmailedAt: null },
          });
        }

        interface Candidate {
          kind: 'participant' | 'recipient';
          id: string;
          name: string;
          email: string | null;
          template: {
            filePath: string;
            widthPx: number;
            pageWidthMm: number;
            pageHeightMm: number;
            nameBox: unknown;
            name: string;
          };
        }
        const candidates: Candidate[] = [];
        if (req.body.roleKind === 'ASISTENTE') {
          const template = req.body.templateId
            ? await prisma.certificateTemplate.findUnique({ where: { id: req.body.templateId } })
            : await prisma.certificateTemplate.findFirst({
                where: { eventId: event.id, roleKind: 'ASISTENTE', isDefault: true },
              });
          if (!template)
            throw new DomainError(
              'NO_DEFAULT_TEMPLATE',
              'No hay plantilla predeterminada para ASISTENTE'
            );
          let participants = await prisma.participant.findMany({
            where: { eventId: event.id, certificateEmailedAt: null },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          });
          if (req.body.scope === 'selected' && req.body.ids) {
            const ids = new Set(req.body.ids);
            participants = participants.filter((p) => ids.has(p.id));
          }
          if (req.body.scope === 'eligible') {
            const total = sessions.length;
            const filtered = [];
            for (const p of participants) {
              const attended = await prisma.attendance.count({
                where: { participantId: p.id, voidedAt: null },
              });
              if (
                event.issuesCertificate &&
                attendancePercentage(attended, total) >= event.minAttendancePercent
              ) {
                filtered.push(p);
              }
            }
            participants = filtered;
          }
          for (const p of participants) {
            candidates.push({
              kind: 'participant',
              id: p.id,
              name: `${p.firstName} ${p.lastName}`,
              email: p.email,
              template,
            });
          }
        } else {
          let recipients = await prisma.certificateRecipient.findMany({
            where: {
              eventId: event.id,
              roleKind: req.body.roleKind,
              certificateEmailedAt: null,
              ...(req.body.templateId ? { templateId: req.body.templateId } : {}),
            },
            include: { template: true },
            orderBy: { createdAt: 'asc' },
          });
          if (req.body.scope === 'selected' && req.body.ids) {
            const ids = new Set(req.body.ids);
            recipients = recipients.filter((r) => ids.has(r.id));
          }
          // Recipients always need an email provided per send; bulk uses stored? Recipients have no email column!
          // Bulk for manual roles requires emails map — out of scope: skip with notice.
          for (const r of recipients) {
            candidates.push({
              kind: 'recipient',
              id: r.id,
              name: r.fullName,
              email: r.email,
              template: r.template,
            });
          }
        }

        // Recipients manuales no guardan correo: se omiten en masivo (envío individual sí).
        const emailable = candidates.filter((c) => c.email);
        const skippedNoEmail = candidates.length - emailable.length;
        const batch = emailable.slice(
          req.body.offset,
          req.body.offset + Math.min(BATCH_SIZE, remaining)
        );
        const failed: Array<{ id: string; name: string; error: string }> = [];
        let sent = 0;
        for (const candidate of batch) {
          if ((await emailedToday(event.id)) >= limit) break;
          const pdf = await renderOnePdf(privateStorage, candidate.template, candidate.name);
          const texts = mailTexts(eventWithSessions, candidate.template.name, candidate.name);
          try {
            await sendCertificateMail(env, {
              to: candidate.email as string,
              subject: texts.subject,
              text: texts.text,
              pdf,
              filename: 'certificado.pdf',
            });
            if (candidate.kind === 'participant') {
              await prisma.participant.update({
                where: { id: candidate.id },
                data: { certificateEmailedAt: new Date(), certificateEmailError: null },
              });
            } else {
              await prisma.certificateRecipient.update({
                where: { id: candidate.id },
                data: { certificateEmailedAt: new Date(), certificateEmailError: null },
              });
            }
            sent += 1;
          } catch (err) {
            const message = (err instanceof Error ? err.message : 'Fallo el envío').slice(0, 200);
            if (candidate.kind === 'participant') {
              await prisma.participant.update({
                where: { id: candidate.id },
                data: { certificateEmailError: message },
              });
            } else {
              await prisma.certificateRecipient.update({
                where: { id: candidate.id },
                data: { certificateEmailError: message },
              });
            }
            failed.push({ id: candidate.id, name: candidate.name, error: message.slice(0, 120) });
          }
          await sleep(200);
        }
        const pending = Math.max(0, emailable.length - req.body.offset - sent - failed.length);
        res.json({
          sent,
          failed,
          skippedNoEmail,
          pending,
          done: pending === 0,
          limited: (await emailedToday(event.id)) >= limit,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // Probar envío: certificado de muestra al correo indicado.
  router.post(
    '/events/:id/test-certificate-email',
    admin,
    validateBody(z.object({ email: z.string().email('El correo no es válido') })),
    async (req: AuthRequest, res, next) => {
      try {
        requireSmtp();
        const prisma = getPrisma();
        await assertEventAccess(prisma, req.user, req.params.id, 'MANAGER');
        const template = await prisma.certificateTemplate.findFirst({
          where: { eventId: req.params.id, isDefault: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!template)
          throw new DomainError('NO_DEFAULT_TEMPLATE', 'No hay plantilla predeterminada');
        const pdf = await renderOnePdf(privateStorage, template, 'Nombre de muestra');
        await sendCertificateMail(env, {
          to: req.body.email,
          subject: 'Prueba de envío de certificados',
          text: 'Este es un certificado de muestra para verificar el correo.',
          pdf,
          filename: 'muestra.pdf',
        });
        res.json({ sent: req.body.email });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
