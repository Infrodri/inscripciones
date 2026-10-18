import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';
import { attendancePercentage } from '../../application/attendanceService.js';
import {
  normalizeCi,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from '../../shared/normalize.js';
import { personSchema } from '../personSchema.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { createMailer } from '@inscripciones/infrastructure/mailer.js';
import { buildConfirmationMail } from '../../application/confirmationMail.js';
import { parseEnv } from '../env.js';
import { assertEventAccess } from '../../application/accessControl.js';

// Listado con datos personales: solo ADMIN/STAFF autenticados (STAFF lo usa en puerta).
export function participantRoutes(): Router {
  const router = Router();
  router.get(
    '/event/:eventId',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const event = await assertEventAccess(prisma, req.user, req.params.eventId, 'OPERATOR');
        const params = parsePagination(req.query);
        const query =
          typeof req.query.q === 'string' && req.query.q.trim() !== '' ? req.query.q.trim() : null;
        const typeFilter =
          typeof req.query.type === 'string' && req.query.type !== '' ? req.query.type : null;
        const where = {
          eventId: req.params.eventId,
          ...(typeFilter ? { type: typeFilter as never } : {}),
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query } },
                  { lastName: { contains: query } },
                  { ci: { contains: query } },
                  { email: { contains: query } },
                ],
              }
            : {}),
        };
        const [items, total] = await Promise.all([
          prisma.participant.findMany({
            where,
            skip: (params.page - 1) * params.pageSize,
            take: params.pageSize,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          }),
          prisma.participant.count({ where }),
        ]);
        // Con ?stats=1 agrega asistencia y aptitud por inscrito (filtros y diplomas).
        if (req.query.stats === '1') {
          const event = await prisma.event.findUnique({
            where: { id: req.params.eventId },
            include: { sessions: { select: { id: true } } },
          });
          if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
          const totalSessions = event.sessions.length;
          const onlyEligible = req.query.eligible;
          // El filtro de aptitud se calcula por fila: sin paginar en BD.
          const base = await prisma.participant.findMany({
            where,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            ...(onlyEligible
              ? {}
              : { skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
          });
          const withStats = await Promise.all(
            base.map(async (participant) => {
              const attended = await prisma.attendance.count({
                where: { participantId: participant.id, voidedAt: null },
              });
              const pct = attendancePercentage(attended, totalSessions);
              return {
                ...participant,
                attended,
                pct,
                eligible: event.issuesCertificate && pct >= event.minAttendancePercent,
              };
            })
          );
          const filtered =
            onlyEligible === 'true'
              ? withStats.filter((p) => p.eligible)
              : onlyEligible === 'false'
                ? withStats.filter((p) => !p.eligible)
                : withStats;
          const page = onlyEligible
            ? filtered.slice((params.page - 1) * params.pageSize, params.page * params.pageSize)
            : filtered;
          res.json({
            ...paginatedResponse(page, onlyEligible ? filtered.length : total, params),
            totalSessions,
          });
          return;
        }
        res.json(paginatedResponse(items, total, params));
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/:id/attendances', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({ where: { id: req.params.id } });
      if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
      await assertEventAccess(prisma, req.user, participant.eventId, 'OPERATOR');
      const items = await prisma.attendance.findMany({
        where: { participantId: participant.id },
        include: { session: { select: { id: true, label: true, startsAt: true } } },
        orderBy: { scannedAt: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });

  const participantUpdateSchema = personSchema
    .partial()
    .extend({ type: z.enum(['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO']).optional() });

  // Editar inscrito (MANAGER o ADMIN): mismas reglas que la inscripción; conserva qr_token. Auditado.
  router.patch(
    '/:id',
    requireRole('ADMIN', 'STAFF'),
    validateBody(participantUpdateSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const participant = await prisma.participant.findUnique({ where: { id: req.params.id } });
        if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
        await assertEventAccess(prisma, req.user, participant.eventId, 'MANAGER');
        const data: Record<string, unknown> = {};
        if (req.body.firstName !== undefined) {
          const value = normalizeName(String(req.body.firstName));
          if (value === '') throw new DomainError('VALIDATION_ERROR', 'El nombre es obligatorio');
          data.firstName = value;
        }
        if (req.body.lastName !== undefined) {
          const value = normalizeName(String(req.body.lastName));
          if (value === '') throw new DomainError('VALIDATION_ERROR', 'El apellido es obligatorio');
          data.lastName = value;
        }
        if (req.body.ci !== undefined) {
          const value = normalizeCi(String(req.body.ci));
          if (!/^[A-Z0-9]{5,15}$/.test(value)) {
            throw new DomainError(
              'VALIDATION_ERROR',
              'El CI debe tener de 5 a 15 caracteres alfanuméricos'
            );
          }
          const dup = await prisma.participant.findFirst({
            where: { eventId: participant.eventId, ci: value, id: { not: participant.id } },
          });
          if (dup)
            throw new DomainError('DUPLICATE_REGISTRATION', 'Ese CI ya está inscrito en el evento');
          data.ci = value;
        }
        if (req.body.email !== undefined) {
          const value = normalizeEmail(req.body.email ?? null);
          if (value) {
            const dup = await prisma.participant.findFirst({
              where: { eventId: participant.eventId, email: value, id: { not: participant.id } },
            });
            if (dup)
              throw new DomainError(
                'DUPLICATE_REGISTRATION',
                'Ese correo ya está inscrito en el evento'
              );
          }
          data.email = value;
        }
        if (req.body.phone !== undefined) data.phone = normalizePhone(req.body.phone ?? null);
        if (req.body.type !== undefined) data.type = req.body.type;
        if (req.body.institution !== undefined)
          data.institution = req.body.institution?.trim() || null;
        if (req.body.career !== undefined) data.career = req.body.career?.trim() || null;
        if (req.body.semester !== undefined) data.semester = req.body.semester?.trim() || null;
        const before = { ...participant };
        const updated = await prisma.participant.update({ where: { id: participant.id }, data });
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: 'participant.update',
            entity: 'participant',
            entityId: participant.id,
            metadata: {
              before: {
                firstName: before.firstName,
                lastName: before.lastName,
                ci: before.ci,
                email: before.email,
              },
              after: {
                firstName: updated.firstName,
                lastName: updated.lastName,
                ci: updated.ci,
                email: updated.email,
              },
            },
          },
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // Eliminar inscrito (MANAGER o ADMIN): se impide si tiene asistencias (conserva reportes). Auditado.
  router.delete('/:id', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({ where: { id: req.params.id } });
      if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
      await assertEventAccess(prisma, req.user, participant.eventId, 'MANAGER');
      const attendances = await prisma.attendance.count({
        where: { participantId: participant.id },
      });
      if (attendances > 0) {
        throw new DomainError(
          'VALIDATION_ERROR',
          'No se puede eliminar: tiene asistencias registradas'
        );
      }
      await prisma.participant.delete({ where: { id: participant.id } });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'participant.delete',
          entity: 'participant',
          entityId: participant.id,
          metadata: { ci: participant.ci, email: participant.email },
        },
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Reenviar QR por correo (OPERATOR o ADMIN). Mismo manejo de fallo que certificados.
  router.post('/:id/resend-qr', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({
        where: { id: req.params.id },
        include: { event: { include: { sessions: { orderBy: { startsAt: 'asc' } } } } },
      });
      if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
      await assertEventAccess(prisma, req.user, participant.eventId, 'OPERATOR');
      if (!participant.email) throw new DomainError('VALIDATION_ERROR', 'Sin correo');
      const env = parseEnv(process.env);
      if (!env.SMTP_HOST)
        throw new DomainError('VALIDATION_ERROR', 'Correo no configurado en el servidor');
      const mail = buildConfirmationMail(
        {
          firstName: participant.firstName,
          lastName: participant.lastName,
          email: participant.email,
        },
        {
          title: participant.event.title,
          institution: participant.event.institution,
          location: participant.event.location,
          contactWhatsapp: participant.event.contactWhatsapp,
          sessions: participant.event.sessions.map((s) => ({
            startsAt: s.startsAt,
            location: s.location,
          })),
        }
      );
      const qrPng = await qrPngBuffer(participant.qrToken);
      try {
        await createMailer({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER ?? '',
          pass: env.SMTP_PASS ?? '',
          from: env.MAIL_FROM,
        }).sendMail({ ...mail, qrPng });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fallo el envío';
        throw new DomainError('VALIDATION_ERROR', `Falló: ${message.slice(0, 120)}`);
      }
      res.json({ sent: participant.email });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
