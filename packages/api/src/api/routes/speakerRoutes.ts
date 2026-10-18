import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { DomainError } from '../../domain/errors.js';

const speakerSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().min(1),
  titleProfession: z.string().nullable().optional(),
  role: z.enum(['EXPOSITOR', 'MODERADOR']),
  institution: z.string().nullable().optional(),
  position: z.number().default(0),
});

const speakerUpdateSchema = speakerSchema.partial().omit({ eventId: true });

export function speakerRoutes(): Router {
  const router = Router();
  router.get(
    '/event/:eventId',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({
          where: { id: req.params.eventId },
          select: { id: true, createdBy: true, creator: { select: { role: true } } },
        });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        if (
          req.user?.role === 'STAFF' &&
          event.createdBy !== req.user.id &&
          event.creator?.role === 'STAFF'
        ) {
          throw new DomainError(
            'FORBIDDEN',
            'No tiene permiso para ver los expositores de este evento'
          );
        }
        const items = await prisma.speaker.findMany({
          where: { eventId: req.params.eventId },
          orderBy: { position: 'asc' },
        });
        res.json({ data: items });
      } catch (err) {
        next(err);
      }
    }
  );
  router.post('/', requireRole('ADMIN'), validateBody(speakerSchema), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const created = await prisma.speaker.create({ data: req.body });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });
  router.put(
    '/:id',
    requireRole('ADMIN'),
    validateBody(speakerUpdateSchema),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const updated = await prisma.speaker.update({
          where: { id: req.params.id },
          data: req.body,
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );
  router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      await prisma.speaker.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
  return router;
}
