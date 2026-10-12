import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { createMailer } from '@inscripciones/infrastructure/mailer.js';
import {
  assertCapacity,
  assertRegistrationOpen,
  buildParticipantRow,
} from '../../application/registrationService.js';
import { buildConfirmationMail } from '../../application/confirmationMail.js';
import { bannerPublicUrl, qrPngUrl, type PublicUrlEnv } from '../../shared/urls.js';
import { logger } from '../../shared/logger.js';
import type { AppEnv } from '../env.js';

const registrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ci: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  type: z.enum(['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO']),
  institution: z.string().nullable().optional(),
  career: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
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
    contactWhatsapp: event['contactWhatsapp'],
    issuesCertificate: event['issuesCertificate'],
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
  };
}

export function publicRoutes(env: AppEnv): Router {
  const router = Router();

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
          const registered = await tx.participant.count({ where: { eventId: event.id } });
          assertCapacity(registered, event.capacity);
          return tx.participant.create({ data: buildParticipantRow(event.id, req.body) });
        });
        let mailSent = false;
        if (env.SMTP_HOST) {
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
          notice: mailSent
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

  return router;
}
