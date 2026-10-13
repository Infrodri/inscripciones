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
  role: z.enum(['SUPERADMIN', 'ADMIN', 'STAFF']),
});

// Alta de usuarios (solo SUPERADMIN puede crear SUPERADMIN; ADMIN crea ADMIN o STAFF).
// La pantalla /admin/usuarios soporta ambos roles.
export function userRoutes(): Router {
  const router = Router();
  router.get('/', requireRole('SUPERADMIN'), async (_req, res, next) => {
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
  router.post('/', requireRole('SUPERADMIN'), validateBody(createUserSchema), async (req, res, next) => {
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
  // SUPERADMIN puede promocionar a ADMIN/STAFF y ver audit logs
  router.patch('/:id/role', validateBody(z.object({ role: z.enum(['ADMIN', 'STAFF', 'SUPERADMIN']) })), requireRole('SUPERADMIN'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: req.body.role },
        select: { id: true, email: true, name: true, role: true, active: true },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });
  router.get('/:id/audit-logs', requireRole('SUPERADMIN'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const logs = await prisma.auditLog.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ data: logs });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
