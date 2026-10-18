import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateEventInput } from '../../application/eventService.js';
import { registrationReason } from '../../application/registrationState.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';
import type { FileStorage } from '@inscripciones/infrastructure/fileStorage.js';
import { filePublicUrl, type PublicUrlEnv } from '../../shared/urls.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const eventSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  eventKind: z.string().min(1),
  institution: z.string().min(1),
  commemoration: z.string().nullable().optional(),
  organizer: z.string().min(1),
  audienceNote: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  location: z.string().min(1),
  mapUrl: z.string().nullable().optional(),
  modality: z.enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDO']).optional(),
  capacity: z.number().int().min(0).nullable().optional(),
  registrationDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(['BORRADOR', 'ABIERTO', 'CERRADO', 'FINALIZADO']).optional(),
  isFree: z.boolean().optional(),
  cost: z.number().positive().nullable().optional(),
  contactWhatsapp: z.string().nullable().optional(),
  issuesCertificate: z.boolean().optional(),
  minAttendancePercent: z.number().int().min(0).max(100).optional(),
  checkinWindowMinutes: z.number().int().min(0).optional(),
  requireCareer: z.boolean().optional(),
  requireSemester: z.boolean().optional(),
  requireInstitution: z.boolean().optional(),
  requirePhone: z.boolean().optional(),
  emailCertificates: z.boolean().optional(),
  certificateEmailSubject: z.string().nullable().optional(),
  certificateEmailBody: z.string().nullable().optional(),
});

async function validateBanner(
  buffer: Buffer,
  mimetype: string
): Promise<{ width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimetype)) {
    throw new DomainError('UNSUPPORTED_FILE', 'El afiche debe ser PNG, JPG o WebP');
  }
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height || !meta.format) {
      throw new DomainError('UNSUPPORTED_FILE', 'El archivo no es una imagen válida');
    }
    return { width: meta.width, height: meta.height };
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError('UNSUPPORTED_FILE', 'El archivo no es una imagen válida');
  }
}

export function eventRoutes(publicStorage: FileStorage, env?: PublicUrlEnv): Router {
  const router = Router();

  router.get('/', async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const params = parsePagination(req.query);
      const whereClause = req.user?.role === 'STAFF' ? { createdBy: req.user.id } : {};
      const [items, total] = await Promise.all([
        prisma.event.findMany({
          where: whereClause,
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                participants: true,
                speakers: true,
                sessions: true,
              },
            },
          },
        }),
        prisma.event.count({ where: whereClause }),
      ]);
      const enriched = items.map((item) => ({
        ...item,
        participants: item._count.participants,
        participantsCount: item._count.participants,
        speakersCount: item._count.speakers,
        sessionsCount: item._count.sessions,
      }));
      res.json(paginatedResponse(enriched, total, params));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', validateBody(eventSchema), async (req: AuthRequest, res, next) => {
    try {
      validateEventInput(req.body);
      const isFree = req.body.isFree ?? true;
      if (!isFree) {
        if (req.body.cost === undefined || req.body.cost === null || req.body.cost <= 0) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Para un evento de pago el costo es obligatorio y debe ser mayor a 0'
          );
        }
      }
      const cost = isFree ? null : req.body.cost;
      const prisma = getPrisma();
      const created = await prisma.event.create({
        data: {
          ...req.body,
          isFree,
          cost,
          registrationDeadline: req.body.registrationDeadline
            ? new Date(req.body.registrationDeadline)
            : undefined,
          createdBy: req.user?.id,
        },
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const registered = await prisma.participant.count({ where: { eventId: event.id } });
      res.json({
        ...event,
        registered,
        registrationReason: registrationReason(
          {
            status: event.status,
            capacity: event.capacity,
            registrationDeadline: event.registrationDeadline,
          },
          registered
        ),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/:id/banner',
    requireRole('ADMIN'),
    upload.single('banner'),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.file) throw new DomainError('VALIDATION_ERROR', 'Debe adjuntar el afiche');
        await validateBanner(req.file.buffer, req.file.mimetype);
        const prisma = getPrisma();
        const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
        const key = `banners/${req.params.id}/${randomUUID()}.${ext}`;
        // Copia reducida a 1200px de ancho para og:image/share, mismo bucket público.
        const shareBuffer = await sharp(req.file.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        const shareKey = `banners/${req.params.id}/share-${randomUUID()}.jpg`;
        await publicStorage.save(req.file.buffer, key, req.file.mimetype);
        await publicStorage.save(shareBuffer, shareKey, 'image/jpeg');
        const updated = await prisma.event.update({
          where: { id: req.params.id },
          data: { bannerPath: key, shareImagePath: shareKey },
        });
        res.json({ bannerPath: updated.bannerPath, shareImagePath: updated.shareImagePath });
      } catch (err) {
        const fileErr = err as { code?: string };
        if (fileErr?.code === 'LIMIT_FILE_SIZE') {
          next(new DomainError('FILE_TOO_LARGE', 'El afiche supera los 10 MB'));
          return;
        }
        next(err);
      }
    }
  );

  const qrUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  router.post(
    '/:id/institution-qr',
    requireRole('ADMIN'),
    qrUpload.any(),
    async (req: AuthRequest, res, next) => {
      try {
        const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
        if (!file) throw new DomainError('VALIDATION_ERROR', 'Debe adjuntar el archivo');
        if (!['image/png', 'image/svg+xml'].includes(file.mimetype)) {
          throw new DomainError('UNSUPPORTED_FILE', 'El QR institucional debe ser PNG o SVG');
        }
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');

        const ext = file.mimetype === 'image/svg+xml' ? 'svg' : 'png';
        const key = `institution-qr/${req.params.id}/${randomUUID()}.${ext}`;
        const stored = await publicStorage.save(file.buffer, key, file.mimetype);
        const url =
          stored.url ??
          (env
            ? filePublicUrl(env, key)
            : `${process.env.API_PUBLIC_URL || 'http://localhost:3001'}/uploads/${key}`);

        await prisma.event.update({
          where: { id: req.params.id },
          data: { institutionQr: url },
        });

        res.json({ url });
      } catch (err) {
        const fileErr = err as { code?: string };
        if (fileErr?.code === 'LIMIT_FILE_SIZE') {
          next(new DomainError('FILE_TOO_LARGE', 'El QR institucional supera los 2 MB'));
          return;
        }
        next(err);
      }
    }
  );

  router.post('/:id/publish', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { status: 'ABIERTO' },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'event.publish',
          entity: 'event',
          entityId: event.id,
          metadata: { from: event.status, to: 'ABIERTO' },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Cerrar inscripciones (solo desde ABIERTO) y reabrir (solo desde CERRADO).
  // No tocan BORRADOR ni FINALIZADO.
  router.post('/:id/close', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      if (event.status !== 'ABIERTO') {
        throw new DomainError('VALIDATION_ERROR', 'Solo se puede cerrar un evento abierto');
      }
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { status: 'CERRADO' },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'event.close',
          entity: 'event',
          entityId: event.id,
          metadata: { from: 'ABIERTO', to: 'CERRADO' },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Reabrir exige nueva fecha límite (o quitarla) si la actual ya venció.
  router.post(
    '/:id/reopen',
    requireRole('ADMIN'),
    validateBody(
      z.object({
        registrationDeadline: z.string().datetime({ offset: true }).nullable().optional(),
        removeDeadline: z.boolean().optional(),
      })
    ),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        if (event.status !== 'CERRADO') {
          throw new DomainError('VALIDATION_ERROR', 'Solo se puede reabrir un evento cerrado');
        }
        const expired = event.registrationDeadline && new Date() > event.registrationDeadline;
        let deadline: Date | null | undefined;
        if (expired) {
          if (req.body.removeDeadline) {
            deadline = null;
          } else if (req.body.registrationDeadline) {
            deadline = new Date(req.body.registrationDeadline);
            if (deadline <= new Date()) {
              throw new DomainError('VALIDATION_ERROR', 'La nueva fecha límite debe ser futura');
            }
          } else {
            throw new DomainError(
              'VALIDATION_ERROR',
              'La fecha límite venció: fije una nueva o márquela sin fecha límite'
            );
          }
        } else if (req.body.registrationDeadline !== undefined) {
          deadline =
            req.body.registrationDeadline === null ? null : new Date(req.body.registrationDeadline);
        }
        const updated = await prisma.event.update({
          where: { id: event.id },
          data: {
            status: 'ABIERTO',
            ...(deadline !== undefined ? { registrationDeadline: deadline } : {}),
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: 'event.reopen',
            entity: 'event',
            entityId: event.id,
            metadata: { from: 'CERRADO', to: 'ABIERTO' },
          },
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // Finalizar (ADMIN): cierra inscripciones y todos los registros de sala.
  // Conserva todo para certificados.
  router.post('/:id/finalize', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: { sessions: { select: { id: true } } },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      if (event.status === 'FINALIZADO') {
        throw new DomainError('VALIDATION_ERROR', 'El evento ya está finalizado');
      }
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { status: 'FINALIZADO' },
      });
      await prisma.session.updateMany({
        where: { eventId: event.id },
        data: { selfCheckinOpen: false },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'event.finalize',
          entity: 'event',
          entityId: event.id,
          metadata: { from: event.status, to: 'FINALIZADO' },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/:id',
    requireRole('ADMIN'),
    validateBody(eventSchema.partial()),
    async (req, res, next) => {
      try {
        if (
          req.body.capacity !== undefined &&
          req.body.capacity !== null &&
          req.body.capacity < 0
        ) {
          throw new DomainError('VALIDATION_ERROR', 'El cupo no puede ser negativo');
        }
        if (
          req.body.minAttendancePercent !== undefined &&
          (req.body.minAttendancePercent < 0 || req.body.minAttendancePercent > 100)
        ) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'El porcentaje mínimo debe estar entre 0 y 100'
          );
        }
        const prisma = getPrisma();
        let costToUpdate: number | null | undefined = undefined;

        if (req.body.isFree !== undefined || req.body.cost !== undefined) {
          const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
          if (!existing) throw new DomainError('NOT_FOUND', 'Evento no encontrado');

          const effectiveIsFree = req.body.isFree !== undefined ? req.body.isFree : existing.isFree;
          const currentSavedCost = existing.cost !== null ? Number(existing.cost) : null;
          const effectiveCost = req.body.cost !== undefined ? req.body.cost : currentSavedCost;

          if (!effectiveIsFree) {
            if (effectiveCost === undefined || effectiveCost === null || effectiveCost <= 0) {
              throw new DomainError(
                'VALIDATION_ERROR',
                'Para un evento de pago el costo es obligatorio y debe ser mayor a 0'
              );
            }
            costToUpdate = effectiveCost;
          } else {
            costToUpdate = null;
          }
        }

        const updated = await prisma.event.update({
          where: { id: req.params.id },
          data: {
            ...req.body,
            ...(costToUpdate !== undefined ? { cost: costToUpdate } : {}),
            registrationDeadline: req.body.registrationDeadline
              ? new Date(req.body.registrationDeadline)
              : undefined,
          },
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post('/:id/duplicate', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const body = z
        .object({
          title: z.string().min(1),
          slug: z.string().min(1),
          daysShift: z.number().default(1),
        })
        .parse(req.body);
      const prisma = getPrisma();
      const source = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: { speakers: true, sponsors: true, sessions: true, certificateTemplates: true },
      });
      if (!source) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const shiftMs = body.daysShift * 24 * 3_600_000;
      const created = await prisma.event.create({
        data: {
          slug: body.slug,
          title: body.title,
          eventKind: source.eventKind,
          institution: source.institution,
          commemoration: source.commemoration,
          organizer: source.organizer,
          audienceNote: source.audienceNote,
          description: source.description,
          location: source.location,
          modality: source.modality,
          capacity: source.capacity,
          status: 'BORRADOR',
          isFree: source.isFree,
          contactWhatsapp: source.contactWhatsapp,
          issuesCertificate: source.issuesCertificate,
          minAttendancePercent: source.minAttendancePercent,
          checkinWindowMinutes: source.checkinWindowMinutes,
          createdBy: req.user?.id,
          speakers: {
            create: source.speakers.map((s) => ({
              fullName: s.fullName,
              titleProfession: s.titleProfession,
              role: s.role,
              institution: s.institution,
              position: s.position,
            })),
          },
          sponsors: {
            create: source.sponsors.map((s) => ({ name: s.name, position: s.position })),
          },
          sessions: {
            create: source.sessions.map((s) => ({
              startsAt: new Date(s.startsAt.getTime() + shiftMs),
              endsAt: s.endsAt ? new Date(s.endsAt.getTime() + shiftMs) : null,
              location: s.location,
              label: s.label,
            })),
          },
          // Plantillas: se copian las filas (comparten el archivo privado).
          // No se copian inscritos, asistencias ni receptores manuales.
          certificateTemplates: {
            create: source.certificateTemplates.map((t) => ({
              roleKind: t.roleKind,
              name: t.name,
              filePath: t.filePath,
              widthPx: t.widthPx,
              heightPx: t.heightPx,
              pageWidthMm: t.pageWidthMm,
              pageHeightMm: t.pageHeightMm,
              nameBox: t.nameBox ?? {},
              isDefault: t.isDefault,
            })),
          },
        },
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Eliminar evento (solo ADMIN) — cascada en transacción, audit_log, limpieza storage
  // Si tiene inscritos: exige título exacto en body { title: string }
  router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const eventId = req.params.id;
      const providedTitle = (req.body?.title ?? req.query?.title)?.toString().trim();

      // 1. Cargar evento y conteos para audit_log
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          _count: {
            select: {
              sessions: true,
              speakers: true,
              sponsors: true,
              participants: true,
              certificateTemplates: true,
            },
          },
          certificateTemplates: { select: { filePath: true } },
        },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');

      const registeredCount = event._count.participants;
      const hasInscritos = registeredCount > 0;

      // Si tiene inscritos, exigir título exacto
      if (hasInscritos) {
        if (!providedTitle) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Este evento tiene inscritos. Debe escribir el título exacto para confirmar la eliminación.'
          );
        }
        if (providedTitle !== event.title) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'El título no coincide. Escriba el título exacto del evento para confirmar.'
          );
        }
      }

      // 2. Ejecutar cascada en transacción
      await prisma.$transaction(async (tx) => {
        // Asistencias (FK en sessions/participants)
        await tx.attendance.deleteMany({ where: { session: { eventId } } });
        // Sesiones
        await tx.session.deleteMany({ where: { eventId } });
        // Expositores
        await tx.speaker.deleteMany({ where: { eventId } });
        // Auspiciantes
        await tx.sponsor.deleteMany({ where: { eventId } });
        // Receptores de certificados
        await tx.certificateRecipient.deleteMany({ where: { eventId } });
        // Plantillas de certificado
        await tx.certificateTemplate.deleteMany({ where: { eventId } });
        // Inscritos
        await tx.participant.deleteMany({ where: { eventId } });
        // Evento
        await tx.event.delete({ where: { id: eventId } });
      });

      // 3. Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'event.delete',
          entity: 'event',
          entityId: eventId,
          metadata: {
            title: event.title,
            slug: event.slug,
            counts: {
              sessions: event._count.sessions,
              speakers: event._count.speakers,
              sponsors: event._count.speakers,
              participants: event._count.participants,
              certificateTemplates: event._count.certificateTemplates,
            },
          },
        },
      });

      // 4. Limpieza de storage (afiche y plantillas) — solo si no hay otro evento que los referencie
      const pathsToCheck = [
        event.bannerPath,
        event.shareImagePath,
        ...event.certificateTemplates.map((t) => t.filePath),
      ].filter(Boolean);

      for (const path of pathsToCheck) {
        if (!path) continue;
        const stillUsed = await prisma.event.findFirst({
          where: {
            OR: [
              { bannerPath: path },
              { shareImagePath: path },
              { certificateTemplates: { some: { filePath: path } } },
            ],
          },
          select: { id: true },
        });
        if (!stillUsed) {
          await publicStorage.remove(path).catch(() => {}); // best effort
        }
      }

      res.json({ success: true, deletedTitle: event.title });
    } catch (err) {
      next(err);
    }
  });

  // Eliminación masiva (solo ADMIN) — cascada en transacción, audit_log, limpieza storage
  // Body: { ids: string[], titles?: Record<string, string> }
  // Si algún evento tiene inscritos, titles es obligatorio y debe coincidir exactamente
  router.post('/bulk-delete', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const ids = z.array(z.string().uuid()).min(1).parse(req.body.ids);
      const providedTitles = (req.body.titles ?? {}) as Record<string, string>;

      const events = await prisma.event.findMany({
        where: { id: { in: ids } },
        include: {
          _count: {
            select: {
              sessions: true,
              speakers: true,
              sponsors: true,
              participants: true,
              certificateTemplates: true,
            },
          },
          certificateTemplates: { select: { filePath: true } },
        },
      });

      if (events.length !== ids.length) {
        throw new DomainError('NOT_FOUND', 'Algunos eventos no existen');
      }

      // Validar títulos para eventos con inscritos
      for (const event of events) {
        const hasInscritos = event._count.participants > 0;
        if (hasInscritos) {
          const providedTitle = providedTitles[event.id]?.trim();
          if (!providedTitle) {
            throw new DomainError(
              'VALIDATION_ERROR',
              `El evento "${event.title}" tiene inscritos. Debe proporcionar el título exacto en el campo titles["${event.id}"].`
            );
          }
          if (providedTitle !== event.title) {
            throw new DomainError(
              'VALIDATION_ERROR',
              `El título para "${event.title}" no coincide. Escriba el título exacto.`
            );
          }
        }
      }

      // Cascada en transacción por cada evento
      for (const event of events) {
        await prisma.$transaction(async (tx) => {
          await tx.attendance.deleteMany({ where: { session: { eventId: event.id } } });
          await tx.session.deleteMany({ where: { eventId: event.id } });
          await tx.speaker.deleteMany({ where: { eventId: event.id } });
          await tx.sponsor.deleteMany({ where: { eventId: event.id } });
          await tx.certificateRecipient.deleteMany({ where: { eventId: event.id } });
          await tx.certificateTemplate.deleteMany({ where: { eventId: event.id } });
          await tx.participant.deleteMany({ where: { eventId: event.id } });
          await tx.event.delete({ where: { id: event.id } });
        });

        // Audit log por evento
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: 'event.bulk-delete',
            entity: 'event',
            entityId: event.id,
            metadata: {
              title: event.title,
              slug: event.slug,
              counts: {
                sessions: event._count.sessions,
                speakers: event._count.speakers,
                sponsors: event._count.sponsors,
                participants: event._count.participants,
                certificateTemplates: event._count.certificateTemplates,
              },
            },
          },
        });

        // Limpieza storage
        const pathsToCheck = [
          event.bannerPath,
          event.shareImagePath,
          ...event.certificateTemplates.map((t) => t.filePath),
        ].filter(Boolean);

        for (const path of pathsToCheck) {
          if (!path) continue;
          const stillUsed = await prisma.event.findFirst({
            where: {
              OR: [
                { bannerPath: path },
                { shareImagePath: path },
                { certificateTemplates: { some: { filePath: path } } },
              ],
            },
            select: { id: true },
          });
          if (!stillUsed) {
            await publicStorage.remove(path).catch(() => {});
          }
        }
      }

      res.json({ success: true, deletedCount: events.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
