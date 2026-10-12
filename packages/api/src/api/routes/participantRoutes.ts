import { Router } from 'express';
import { getPrisma } from '../../infrastructure/prisma.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

// Listado con datos personales: solo ADMIN/STAFF autenticados (STAFF lo usa en puerta).
export function participantRoutes(): Router {
  const router = Router();
  router.get('/event/:eventId', requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const params = parsePagination(req.query);
      const query =
        typeof req.query.q === 'string' && req.query.q.trim() !== '' ? req.query.q.trim() : null;
      const where = {
        eventId: req.params.eventId,
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
      res.json(paginatedResponse(items, total, params));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
