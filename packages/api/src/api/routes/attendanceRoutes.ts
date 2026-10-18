import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { assertSessionWindow } from '../../application/attendanceService.js';
import { assertSessionAccess, canAccessEvent } from '../../application/accessControl.js';

const checkinSchema = z.object({
  qrToken: z.string().optional(),
  participantId: z.string().uuid().optional(),
});

const voidSchema = z.object({
  reason: z.string().min(1, 'El motivo de anulación es obligatorio'),
});

export function attendanceRoutes(): Router {
  const router = Router();

  // Registro de asistencia (STAFF o ADMIN). Doble escaneo: 409 sin duplicar.
  router.post(
    '/sessions/:id/check-in',
    requireRole('ADMIN', 'STAFF'),
    validateBody(checkinSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.body.qrToken && !req.body.participantId) {
          throw new DomainError('VALIDATION_ERROR', 'Indique el QR o el participante');
        }
        const prisma = getPrisma();
        const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
        assertSessionWindow(new Date(), {
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          checkinWindowMinutes: session.event.checkinWindowMinutes,
        });
        const participant = req.body.qrToken
          ? await prisma.participant.findUnique({ where: { qrToken: req.body.qrToken } })
          : await prisma.participant.findUnique({ where: { id: req.body.participantId } });
        if (!participant || participant.eventId !== session.eventId) {
          throw new DomainError('INVALID_QR', 'El código QR no es válido');
        }
        const previous = await prisma.attendance.findUnique({
          where: {
            participantId_sessionId: { participantId: participant.id, sessionId: session.id },
          },
        });
        if (previous && !previous.voidedAt) {
          throw new DomainError(
            'ALREADY_CHECKED_IN',
            `Ya se registró la asistencia de ${participant.firstName} ${participant.lastName}`,
            [{ scannedAt: previous.scannedAt }]
          );
        }
        const attendance = previous
          ? previous
          : await prisma.attendance.create({
              data: {
                participantId: participant.id,
                sessionId: session.id,
                registeredBy: req.user?.id,
                method: req.body.qrToken ? 'QR' : 'MANUAL',
              },
            });
        res.status(201).json({
          firstName: participant.firstName,
          lastName: participant.lastName,
          scannedAt: attendance.scannedAt,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // Búsqueda manual de respaldo para el scanner.
  router.get(
    '/sessions/:id/participants/search',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (query === '') {
          res.json({ data: [] });
          return;
        }
        const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
        const items = await prisma.participant.findMany({
          where: {
            eventId: session.eventId,
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { ci: { contains: query } },
            ],
          },
          take: 10,
          select: { id: true, firstName: true, lastName: true, ci: true },
        });
        res.json({ data: items });
      } catch (err) {
        next(err);
      }
    }
  );

  // Quienes marcaron en una sesión (ADMIN o STAFF con acceso), con hora y método.
  router.get('/sessions/:id/attendances', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      const items = await prisma.attendance.findMany({
        where: { sessionId: session.id, voidedAt: null },
        include: {
          participant: { select: { id: true, firstName: true, lastName: true, ci: true } },
        },
        orderBy: { scannedAt: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });

  // Anulación con motivo y auditoría (ADMIN o STAFF con MANAGER). No borra la fila.
  router.post(
    '/attendances/:id/void',
    requireRole('ADMIN', 'STAFF'),
    validateBody(voidSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const attendance = await prisma.attendance.findUnique({
          where: { id: req.params.id },
          include: {
            session: {
              include: {
                event: {
                  include: {
                    staffAssignments: { select: { userId: true, accessLevel: true } },
                    creator: { select: { id: true, role: true } },
                  },
                },
              },
            },
          },
        });
        if (!attendance) throw new DomainError('NOT_FOUND', 'Asistencia no encontrada');
        if (!canAccessEvent(req.user, attendance.session.event, 'MANAGER')) {
          throw new DomainError('FORBIDDEN', 'No tiene permisos para anular asistencias en este evento');
        }
        const updated = await prisma.attendance.update({
          where: { id: attendance.id },
          data: { voidedAt: new Date(), voidedBy: req.user?.id, voidReason: req.body.reason },
        });
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: 'attendance.void',
            entity: 'attendance',
            entityId: attendance.id,
            metadata: { reason: req.body.reason },
          },
        });
        res.json({ id: updated.id, voidedAt: updated.voidedAt });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
