import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { buildParticipantRow } from '../../application/registrationService.js';
import { assertSessionWindow, attendancePercentage } from '../../application/attendanceService.js';
import { renderAttendanceList } from '@inscripciones/infrastructure/pdf.js';
import { logger } from '../../shared/logger.js';

const walkinSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ci: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  type: z.enum(['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO']),
  institution: z.string().nullable().optional(),
  career: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
  sessionId: z.string().uuid(),
});

export function walkinRoutes(): Router {
  const router = Router();

  // Inscripción en puerta: inscribe (WALK_IN) y registra asistencia en un paso.
  // Sin control de estado del evento: el staff en puerta tiene la última palabra.
  router.post(
    '/events/:id/participants',
    requireRole('ADMIN', 'STAFF'),
    validateBody(walkinSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({
          where: { id: req.params.id },
          include: { sessions: true },
        });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        const session = event.sessions.find((s) => s.id === req.body.sessionId);
        if (!session || session.eventId !== event.id)
          throw new DomainError('NOT_FOUND', 'Sesión no encontrada');
        assertSessionWindow(new Date(), {
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          checkinWindowMinutes: event.checkinWindowMinutes,
        });
        const result = await prisma.$transaction(async (tx) => {
          const participant = await tx.participant.create({
            data: buildParticipantRow(event.id, req.body, 'WALK_IN'),
          });
          const attendance = await tx.attendance.create({
            data: {
              participantId: participant.id,
              sessionId: session.id,
              registeredBy: req.user?.id,
              method: 'MANUAL',
            },
          });
          return { participant, attendance };
        });
        res.status(201).json({
          firstName: result.participant.firstName,
          lastName: result.participant.lastName,
          qrToken: result.participant.qrToken,
          scannedAt: result.attendance.scannedAt,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // Estadísticas del evento con porcentaje y aptos (ADMIN o STAFF).
  router.get('/events/:id/stats', requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const event = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: { sessions: { orderBy: { startsAt: 'asc' } } },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      const [participantIds, perSession] = await Promise.all([
        prisma.participant.findMany({ where: { eventId: event.id }, select: { id: true } }),
        Promise.all(
          event.sessions.map(async (session) => ({
            id: session.id,
            label: session.label,
            startsAt: session.startsAt,
            checkedIn: await prisma.attendance.count({
              where: { sessionId: session.id, voidedAt: null },
            }),
          }))
        ),
      ]);
      const totalSessions = event.sessions.length;
      let eligible = 0;
      for (const participant of participantIds) {
        const attended = await prisma.attendance.count({
          where: { participantId: participant.id, voidedAt: null },
        });
        if (attendancePercentage(attended, totalSessions) >= event.minAttendancePercent)
          eligible += 1;
      }
      res.json({
        participants: participantIds.length,
        sessions: totalSessions,
        perSession,
        eligible,
        minAttendancePercent: event.minAttendancePercent,
      });
    } catch (err) {
      next(err);
    }
  });

  // Lista de asistencia imprimible como respaldo sin internet (ADMIN o STAFF).
  router.get(
    '/events/:id/exports/attendance-list.pdf',
    requireRole('ADMIN', 'STAFF'),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({
          where: { id: req.params.id },
          include: { sessions: { orderBy: { startsAt: 'asc' } } },
        });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        const participants = await prisma.participant.findMany({
          where: { eventId: event.id },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
        const participantRows = participants.map((p) => ({
          fullName: `${p.lastName}, ${p.firstName}`,
          ci: p.ci,
        }));
        const sessionPages = event.sessions
          .filter((s) => !req.query.sessionId || s.id === req.query.sessionId)
          .map((session) => ({
            label: session.label,
            startsAt: session.startsAt,
            location: session.location,
            rows: participantRows,
          }));
        // Sin sesiones: una página general para el control manual.
        const sessions =
          sessionPages.length > 0
            ? sessionPages
            : [
                {
                  label: 'Lista general',
                  startsAt: new Date(),
                  location: null,
                  rows: participantRows,
                },
              ];
        res.header('Content-Type', 'application/pdf');
        res.header(
          'Content-Disposition',
          `attachment; filename="lista-asistencia-${event.slug}.pdf"`
        );
        const report = await renderAttendanceList(event.title, sessions, res);
        logger.info('attendance_list_exported', { eventId: event.id, ...report });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
