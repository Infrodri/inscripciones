import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { assertEventAccess, assertSessionAccess } from '../../application/accessControl.js';

const sessionSchema = z.object({
  eventId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

const sessionUpdateSchema = sessionSchema.partial().omit({ eventId: true });

export function sessionRoutes(): Router {
  const router = Router();

  router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/event/:eventId',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        await assertEventAccess(prisma, req.user, req.params.eventId, 'OPERATOR');
        const items = await prisma.session.findMany({
          where: { eventId: req.params.eventId },
          orderBy: { startsAt: 'asc' },
        });
        res.json({ data: items });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/',
    requireRole('ADMIN', 'STAFF'),
    validateBody(sessionSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const startsAt = new Date(req.body.startsAt);
        const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
        if (endsAt && endsAt <= startsAt) {
          throw new DomainError('VALIDATION_ERROR', 'La hora de fin debe ser posterior al inicio');
        }
        const prisma = getPrisma();
        await assertEventAccess(prisma, req.user, req.body.eventId, 'MANAGER');

        const created = await prisma.session.create({
          data: {
            eventId: req.body.eventId,
            startsAt,
            endsAt,
            location: req.body.location ?? null,
            label: req.body.label ?? null,
          },
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/:id',
    requireRole('ADMIN', 'STAFF'),
    validateBody(sessionUpdateSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        await assertSessionAccess(prisma, req.user, req.params.id, 'MANAGER');

        const data: {
          startsAt?: Date;
          endsAt?: Date | null;
          location?: string | null;
          label?: string | null;
        } = {};
        if (req.body.startsAt) data.startsAt = new Date(req.body.startsAt);
        if (req.body.endsAt !== undefined)
          data.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
        if (req.body.location !== undefined) data.location = req.body.location;
        if (req.body.label !== undefined) data.label = req.body.label;

        const updated = await prisma.session.update({ where: { id: req.params.id }, data });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete('/:id', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      await assertSessionAccess(prisma, req.user, req.params.id, 'MANAGER');
      await prisma.session.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
