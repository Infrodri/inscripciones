import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const sponsorSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  position: z.number().default(0),
});

const sponsorUpdateSchema = sponsorSchema.partial().omit({ eventId: true });

export function sponsorRoutes(): Router {
  const router = Router();
  router.get('/event/:eventId', async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const items = await prisma.sponsor.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { position: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });
  router.post('/', requireRole('ADMIN'), validateBody(sponsorSchema), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const created = await prisma.sponsor.create({ data: req.body });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });
  router.put(
    '/:id',
    requireRole('ADMIN'),
    validateBody(sponsorUpdateSchema),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const updated = await prisma.sponsor.update({
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
      await prisma.sponsor.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
  return router;
}
