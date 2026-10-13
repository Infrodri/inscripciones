import { Router } from 'express';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';
import { attendancePercentage } from '../../application/attendanceService.js';

// Listado con datos personales: solo ADMIN/STAFF autenticados (STAFF lo usa en puerta).
export function participantRoutes(): Router {
  const router = Router();
  router.get('/event/:eventId', requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
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
  });

  router.get('/:id/attendances', requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const participant = await prisma.participant.findUnique({ where: { id: req.params.id } });
      if (!participant) throw new DomainError('NOT_FOUND', 'Inscrito no encontrado');
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

  return router;
}
