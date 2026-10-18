import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { personSchema } from '../personSchema.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { renderSingleBadge, type BadgeParticipant } from '@inscripciones/infrastructure/badges.js';
import { createMailer } from '@inscripciones/infrastructure/mailer.js';
import type { FileStorage } from '@inscripciones/infrastructure/fileStorage.js';
import { createStorage } from '../../infrastructure/storage.js';
import {
  assertCapacity,
  assertRegistrationOpen,
  buildParticipantRow,
} from '../../application/registrationService.js';
import { registrationReason } from '../../application/registrationState.js';
import { buildConfirmationMail } from '../../application/confirmationMail.js';
import { bannerPublicUrl, filePublicUrl, qrPngUrl, resolveOrigin, type PublicUrlEnv } from '../../shared/urls.js';
import { logger } from '../../shared/logger.js';
import type { AppEnv } from '../env.js';

const registrationSchema = personSchema.extend({
  type: z.enum(['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO']).default('ESTUDIANTE'),
  institution: z.string().nullable().optional(),
  career: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
  paymentProofUrl: z.string().nullable().optional(),
  dataConsent: z.literal(true),
  // Honeypot anti-bots: los humanos lo dejan vacío.
  website: z.string().optional(),
});

function publicEventView(event: Record<string, unknown>, env: PublicUrlEnv, registered: number) {
  const capacity = event['capacity'] as number | null;
  return {
    slug: event['slug'],
    title: event['title'],
    eventKind: event['eventKind'],
    institution: event['institution'],
    commemoration: event['commemoration'],
    organizer: event['organizer'],
    audienceNote: event['audienceNote'],
    description: event['description'],
    location: event['location'],
    mapUrl: event['mapUrl'],
    modality: event['modality'],
    capacity,
    registrationDeadline: event['registrationDeadline'],
    status: event['status'],
    isFree: event['isFree'],
    cost: event['cost'] !== null && event['cost'] !== undefined ? Number(event['cost']) : null,
    institutionQr: (event['institutionQr'] as string | null) ?? null,
    contactWhatsapp: event['contactWhatsapp'],
    issuesCertificate: event['issuesCertificate'],
    requireCareer: event['requireCareer'] ?? false,
    requireSemester: event['requireSemester'] ?? false,
    requireInstitution: event['requireInstitution'] ?? false,
    requirePhone: event['requirePhone'] ?? false,
    bannerUrl: event['bannerPath'] ? bannerPublicUrl(env, event['bannerPath'] as string) : null,
    shareImageUrl: event['shareImagePath']
      ? bannerPublicUrl(env, event['shareImagePath'] as string)
      : null,
    sessions: event['sessions'],
    speakers: event['speakers'],
    sponsors: event['sponsors'],
    spotsLeft: capacity === null ? null : Math.max(0, capacity - registered),
    registrationOpen:
      event['status'] === 'ABIERTO' &&
      (!event['registrationDeadline'] ||
        new Date() <= new Date(event['registrationDeadline'] as string)),
    registrationReason: registrationReason(
      {
        status: event['status'] as string,
        capacity,
        registrationDeadline: event['registrationDeadline']
          ? new Date(event['registrationDeadline'] as string)
          : null,
      },
      registered
    ),
  };
}

function assertRequiredFields(
  event: {
    requireCareer: boolean;
    requireSemester: boolean;
    requireInstitution: boolean;
    requirePhone: boolean;
  },
  body: {
    career?: string | null;
    semester?: string | null;
    institution?: string | null;
    phone?: string | null;
  }
): void {
  const missing: Array<[boolean, string | null | undefined, string]> = [
    [event.requireCareer, body.career, 'la carrera'],
    [event.requireSemester, body.semester, 'el semestre'],
    [event.requireInstitution, body.institution, 'la institución'],
    [event.requirePhone, body.phone, 'el celular'],
  ];
  for (const [required, value, label] of missing) {
    if (required && (!value || String(value).trim() === '')) {
      throw new DomainError('VALIDATION_ERROR', `En este evento ${label} es obligatorio`);
    }
  }
}

export function publicRoutes(env: AppEnv, storage?: FileStorage): Router {
  const router = Router();
  const publicStorage = storage ?? createStorage(env).publicStorage;

  const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  router.post('/events/:slug/payment-proof', proofUpload.any(), async (req, res, next) => {
    try {
      const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
      if (!file) throw new DomainError('VALIDATION_ERROR', 'Debe adjuntar el comprobante');

      const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(file.mimetype)) {
        throw new DomainError(
          'UNSUPPORTED_FILE',
          'El comprobante debe ser imagen (PNG, JPG, WebP) o PDF'
        );
      }

      const prisma = getPrisma();
      const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      if (event.isFree) {
        throw new DomainError('VALIDATION_ERROR', 'El evento no requiere comprobante de pago');
      }

      const extMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
      };
      const ext = extMap[file.mimetype] ?? 'bin';
      const key = `payment-proofs/${event.id}/${randomUUID()}.${ext}`;
      const stored = await publicStorage.save(file.buffer, key, file.mimetype);
      const url = stored.url ?? filePublicUrl(env, key);

      res.json({ url });
    } catch (err) {
      const fileErr = err as { code?: string };
      if (fileErr?.code === 'LIMIT_FILE_SIZE') {
        next(new DomainError('FILE_TOO_LARGE', 'El comprobante supera los 5 MB'));
        return;
      }
      next(err);
    }
  });

  router.get('/events', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const events = await prisma.event.findMany({
        where: {
          status: { in: ['ABIERTO', 'CERRADO', 'FINALIZADO'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sessions: { orderBy: { startsAt: 'asc' } },
          speakers: { orderBy: { position: 'asc' } },
          sponsors: { orderBy: { position: 'asc' } },
          _count: { select: { participants: true } },
        },
      });
      const items = events.map((event) =>
        publicEventView(event as unknown as Record<string, unknown>, env, event._count.participants)
      );

      // Orden cronológico: eventos activos/próximos más cercanos primero, pasados/finalizados al final.
      const now = Date.now();
      items.sort((a, b) => {
        const aPast = a.status === 'FINALIZADO';
        const bPast = b.status === 'FINALIZADO';

        if (!aPast && bPast) return -1;
        if (aPast && !bPast) return 1;

        if (!aPast && !bPast) {
          const aStarts = (a.sessions as Array<{ startsAt: string }> | undefined)?.[0]?.startsAt
            ? new Date((a.sessions as Array<{ startsAt: string }>)[0].startsAt).getTime()
            : Infinity;
          const bStarts = (b.sessions as Array<{ startsAt: string }> | undefined)?.[0]?.startsAt
            ? new Date((b.sessions as Array<{ startsAt: string }>)[0].startsAt).getTime()
            : Infinity;
          return aStarts - bStarts;
        }

        const aSessions = a.sessions as Array<{ endsAt?: string | null; startsAt: string }> | undefined;
        const bSessions = b.sessions as Array<{ endsAt?: string | null; startsAt: string }> | undefined;
        const aDate = aSessions?.[aSessions.length - 1]?.startsAt
          ? new Date(aSessions[aSessions.length - 1].startsAt).getTime()
          : 0;
        const bDate = bSessions?.[bSessions.length - 1]?.startsAt
          ? new Date(bSessions[bSessions.length - 1].startsAt).getTime()
          : 0;
        return bDate - aDate;
      });

      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/events/:slug', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
          sessions: { orderBy: { startsAt: 'asc' } },
          speakers: { orderBy: { position: 'asc' } },
          sponsors: { orderBy: { position: 'asc' } },
        },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const registered = await prisma.participant.count({ where: { eventId: event.id } });
      res.json(publicEventView(event as unknown as Record<string, unknown>, env, registered));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/events/:slug/registrations',
    validateBody(registrationSchema),
    async (req, res, next) => {
      try {
        // Honeypot: los bots que lo llenan reciben un éxito falso sin crear nada.
        if (req.body.website && String(req.body.website).trim() !== '') {
          res.status(201).json({ ok: true });
          return;
        }
        const prisma = getPrisma();
        const participant = await prisma.$transaction(async (tx) => {
          const event = await tx.event.findUnique({ where: { slug: req.params.slug } });
          if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
          // Bloqueo por evento: resiste carreras de cupo en inscripciones concurrentes.
          await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`;
          assertRegistrationOpen(event, new Date());
          assertRequiredFields(event, req.body);
          if (!event.isFree) {
            if (!req.body.paymentProofUrl || String(req.body.paymentProofUrl).trim() === '') {
              throw new DomainError(
                'VALIDATION_ERROR',
                'Para un evento de pago el comprobante es obligatorio'
              );
            }
          }
          const registered = await tx.participant.count({ where: { eventId: event.id } });
          assertCapacity(registered, event.capacity);
          const paymentProofUrl = !event.isFree ? req.body.paymentProofUrl?.trim() || null : null;
          return tx.participant.create({
            data: {
              ...buildParticipantRow(event.id, req.body),
              paymentProofUrl,
            },
          });
        });
        let mailSent = false;
        if (env.SMTP_HOST && participant.email) {
          try {
            const fullEvent = await prisma.event.findUnique({
              where: { slug: req.params.slug },
              include: { sessions: { orderBy: { startsAt: 'asc' } } },
            });
            const mail = buildConfirmationMail(
              {
                firstName: participant.firstName,
                lastName: participant.lastName,
                email: participant.email,
              },
              {
                title: fullEvent?.title ?? req.params.slug,
                institution: fullEvent?.institution ?? '',
                location: fullEvent?.location ?? '',
                contactWhatsapp: fullEvent?.contactWhatsapp ?? null,
                sessions: (fullEvent?.sessions ?? []).map((s) => ({
                  startsAt: s.startsAt,
                  location: s.location,
                })),
              }
            );
            const qrPng = await qrPngBuffer(participant.qrToken);
            await createMailer({
              host: env.SMTP_HOST,
              port: env.SMTP_PORT,
              user: env.SMTP_USER ?? '',
              pass: env.SMTP_PASS ?? '',
              from: env.MAIL_FROM,
            }).sendMail({ ...mail, qrPng });
            mailSent = true;
          } catch (err) {
            // El correo no hace fallar la inscripción: el QR ya está en pantalla.
            logger.warn('qr_mail_failed', { eventSlug: req.params.slug });
            void err;
          }
        }
        res.status(201).json({
          firstName: participant.firstName,
          lastName: participant.lastName,
          qrToken: participant.qrToken,
          qrPngUrl: qrPngUrl(env, participant.qrToken),
          mailSent,
          notice: !participant.email
            ? 'No indicaste correo: descarga o captura tu QR ahora.'
            : mailSent
              ? null
              : 'No pudimos enviarle el correo; guarde su QR desde esta pantalla.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/registrations/:qrToken/qr.png', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({
        where: { qrToken: req.params.qrToken },
        select: { id: true },
      });
      if (!participant) throw new DomainError('INVALID_QR', 'El código QR no es válido');
      const png = await qrPngBuffer(req.params.qrToken);
      res.header('Content-Type', 'image/png');
      res.send(png);
    } catch (err) {
      next(err);
    }
  });

  router.get('/registrations/:qrToken/badge.pdf', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({
        where: { qrToken: req.params.qrToken },
        include: { event: { include: { sessions: { orderBy: { startsAt: 'asc' } } } } },
      });
      if (!participant) throw new DomainError('INVALID_QR', 'El código QR no es válido');
      const sessions = participant.event.sessions;
      const datesStr =
        sessions.length > 0
          ? `${sessions[0].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}${sessions.length > 1 ? ` - ${sessions[sessions.length - 1].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ` ${sessions[0].startsAt.getFullYear()}`}`
          : null;
      let headerImageBuffer: Buffer | null = null;
      if (participant.event.bannerPath && storage) {
        try {
          headerImageBuffer = await storage.read(participant.event.bannerPath);
        } catch {
          headerImageBuffer = null;
        }
      }
      const badgeData: BadgeParticipant = {
        fullName: `${participant.firstName} ${participant.lastName}`.trim(),
        ci: participant.ci,
        type: participant.type,
        institution: participant.institution,
        career: participant.career,
        eventTitle: participant.event.title,
        eventInstitution: participant.event.institution,
        eventDates: datesStr,
        eventLocation: participant.event.location,
        qrPngBuffer: await qrPngBuffer(participant.qrToken),
        headerImageBuffer: headerImageBuffer ?? undefined,
      };
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', `attachment; filename="credencial-${participant.ci}.pdf"`);
      await renderSingleBadge(badgeData, res);
    } catch (err) {
      next(err);
    }
  });

  // QR del enlace público, para afiches o proyección (contenido: URL absoluta).
  router.get('/events/:slug/link-qr.png', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        select: { id: true },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const origin = resolveOrigin(req, env.PUBLIC_SITE_URL);
      const png = await qrPngBuffer(`${origin}/e/${req.params.slug}`);
      res.header('Content-Type', 'image/png');
      res.send(png);
    } catch (err) {
      next(err);
    }
  });

  // Verificación pública de certificados (por CI + código de verificación).
  router.post(
    '/certificates/verify',
    validateBody(
      z.object({
        ci: z.string().trim().min(3).max(30),
        code: z.string().trim().min(3).max(64),
      })
    ),
    async (req, res, next) => {
      const start = Date.now();
      try {
        const { ci, code } = req.body as { ci: string; code: string };
        const cleanCi = ci.trim().toLowerCase();
        const cleanCode = code.trim();
        const prisma = getPrisma();

        let matched: {
          eventTitle: string;
          eventDate: string | null;
          recipientName: string;
          role: string;
        } | null = null;

        // 1. Buscar en participantes (rol ASISTENTE)
        const participant = await prisma.participant.findUnique({
          where: { certificateCode: cleanCode },
          include: {
            event: {
              include: { sessions: { orderBy: { startsAt: 'asc' } } },
            },
          },
        });

        if (participant && participant.ci.trim().toLowerCase() === cleanCi) {
          const sessions = participant.event.sessions;
          const dateStr = sessions.length > 0 ? sessions[0].startsAt.toISOString() : null;
          const parts = `${participant.firstName} ${participant.lastName}`
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          const maskedName =
            parts.length <= 1
              ? (parts[0] ?? '')
              : `${parts[0]} ${parts
                  .slice(1)
                  .map((p) => `${p[0].toUpperCase()}.`)
                  .join(' ')}`;
          matched = {
            eventTitle: participant.event.title,
            eventDate: dateStr,
            recipientName: maskedName,
            role: 'ASISTENTE',
          };
        } else {
          // 2. Buscar en receptores manuales (EXPOSITOR, ORGANIZADOR, OTRO)
          const recipient = await prisma.certificateRecipient.findUnique({
            where: { certificateCode: cleanCode },
            include: {
              event: {
                include: { sessions: { orderBy: { startsAt: 'asc' } } },
              },
            },
          });

          if (recipient) {
            const noteLower = (recipient.note ?? '').toLowerCase();
            const ciMatched = noteLower.includes(cleanCi);
            if (ciMatched) {
              const sessions = recipient.event.sessions;
              const dateStr = sessions.length > 0 ? sessions[0].startsAt.toISOString() : null;
              const parts = recipient.fullName.trim().split(/\s+/).filter(Boolean);
              const maskedName =
                parts.length <= 1
                  ? (parts[0] ?? '')
                  : `${parts[0]} ${parts
                      .slice(1)
                      .map((p) => `${p[0].toUpperCase()}.`)
                      .join(' ')}`;
              matched = {
                eventTitle: recipient.event.title,
                eventDate: dateStr,
                recipientName: maskedName,
                role: recipient.roleKind,
              };
            }
          }
        }

        // Mitigación de timing attack (respuesta uniforme ~120-170ms)
        const elapsed = Date.now() - start;
        const targetDelay = Math.floor(120 + Math.random() * 50);
        if (elapsed < targetDelay) {
          await new Promise((resolve) => setTimeout(resolve, targetDelay - elapsed));
        }

        const maskedCi =
          cleanCi.length > 3 ? `${cleanCi.slice(0, 2)}***${cleanCi.slice(-1)}` : '***';
        logger.info('public_certificate_verify_attempt', {
          maskedCi,
          codeLength: cleanCode.length,
          success: Boolean(matched),
        });

        if (!matched) {
          res.status(200).json({
            valid: false,
            message: 'No se encontró un certificado válido con los datos proporcionados',
          });
          return;
        }

        res.status(200).json({
          valid: true,
          certificate: matched,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
