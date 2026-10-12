import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { hashPassword } from '../../infrastructure/passwordHasher.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF']),
});

// Alta de usuarios (ADMIN crea ADMIN o STAFF). La pantalla /admin/usuarios va en H2.
export function userRoutes(): Router {
  const router = Router();
  router.get('/', requireRole('ADMIN'), async (_req, res, next) => {
    try {
      const prisma = getPrisma();
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  });
  router.post('/', requireRole('ADMIN'), validateBody(createUserSchema), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const created = await prisma.user.create({
        data: {
          email: req.body.email,
          passwordHash: await hashPassword(req.body.password),
          name: req.body.name,
          role: req.body.role,
        },
        select: { id: true, email: true, name: true, role: true, active: true },
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });
  return router;
}
