import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { verifyPassword } from '../../infrastructure/passwordHasher.js';
import { signAccessToken } from '../../infrastructure/jwtService.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRoutes(jwtSecret: string, expiresIn = '24h'): Router {
  const router = Router();
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (!user || !user.active) throw new DomainError('UNAUTHORIZED', 'Credenciales inválidas');
      const ok = await verifyPassword(req.body.password, user.passwordHash);
      if (!ok) throw new DomainError('UNAUTHORIZED', 'Credenciales inválidas');
      const token = signAccessToken({ sub: user.id, role: user.role }, jwtSecret, expiresIn);
      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
