import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { hashPassword } from '../../infrastructure/passwordHasher.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(8),
});

export function userRoutes(): Router {
  const router = Router();

  router.get('/', requireRole('ADMIN', 'STAFF'), async (_req, res, next) => {
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

  // Modificar usuario (nombre, rol, estado y opcionalmente contraseña)
  router.patch(
    '/:id',
    requireRole('ADMIN'),
    validateBody(updateUserSchema),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado');

        const dataToUpdate: Record<string, unknown> = {};
        if (req.body.name !== undefined) dataToUpdate.name = req.body.name;
        if (req.body.role !== undefined) dataToUpdate.role = req.body.role;
        if (req.body.active !== undefined) dataToUpdate.active = req.body.active;
        if (req.body.active === false) {
          await prisma.eventStaff.deleteMany({
            where: { userId: req.params.id },
          });
        }
        if (req.body.password) {
          dataToUpdate.passwordHash = await hashPassword(req.body.password);
        }

        const updated = await prisma.user.update({
          where: { id: req.params.id },
          data: dataToUpdate,
          select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // Cambiar contraseña directamente por ADMIN
  router.patch(
    '/:id/password',
    requireRole('ADMIN'),
    validateBody(changePasswordSchema),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado');

        const passwordHash = await hashPassword(req.body.password);
        await prisma.user.update({
          where: { id: req.params.id },
          data: { passwordHash },
        });
        res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
      } catch (err) {
        next(err);
      }
    }
  );

  // Obtener eventos asignados a un usuario (ADMIN)
  router.get('/:id/events', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, email: true, role: true, active: true },
      });
      if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado');

      const assignments = await prisma.eventStaff.findMany({
        where: { userId: req.params.id },
        include: {
          event: {
            select: { id: true, title: true, slug: true, status: true, modality: true, location: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        user,
        data: assignments.map((a) => ({
          id: a.id,
          eventId: a.eventId,
          eventTitle: a.event.title,
          eventSlug: a.event.slug,
          eventStatus: a.event.status,
          eventLocation: a.event.location,
          accessLevel: a.accessLevel,
          createdAt: a.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // Asignar/sincronizar eventos delegados a un usuario STAFF o ADMIN
  router.put(
    '/:id/events',
    requireRole('ADMIN'),
    validateBody(
      z.object({
        assignments: z.array(
          z.object({
            eventId: z.string().min(1, 'El ID del evento es requerido'),
            accessLevel: z.enum(['OPERATOR', 'MANAGER']).default('OPERATOR'),
          })
        ),
      })
    ),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado');
        if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Solo se pueden delegar eventos a usuarios del sistema'
          );
        }

        const assignments = req.body.assignments as Array<{
          eventId: string;
          accessLevel: 'OPERATOR' | 'MANAGER';
        }>;

        // Validar si el usuario que asigna existe en la BD para evitar fallos de Foreign Key
        let safeAssignedBy: string | null = null;
        if (req.user?.id) {
          const assigner = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true },
          });
          if (assigner) safeAssignedBy = assigner.id;
        }

        await prisma.$transaction(async (tx) => {
          const targetEventIds = assignments.map((a) => a.eventId);

          // Verificar cuáles eventos existen realmente para no violar integridad referencial
          const existingEvents =
            targetEventIds.length > 0
              ? await tx.event.findMany({
                  where: { id: { in: targetEventIds } },
                  select: { id: true },
                })
              : [];
          const existingEventIds = new Set(existingEvents.map((e) => e.id));
          const validAssignments = assignments.filter((a) => existingEventIds.has(a.eventId));
          const validEventIds = Array.from(existingEventIds);

          // Remover asignaciones que ya no estén en la lista
          if (validEventIds.length === 0) {
            await tx.eventStaff.deleteMany({
              where: { userId: user.id },
            });
          } else {
            await tx.eventStaff.deleteMany({
              where: {
                userId: user.id,
                eventId: { notIn: validEventIds },
              },
            });
          }

          // Crear o actualizar asignaciones seleccionadas
          for (const item of validAssignments) {
            await tx.eventStaff.upsert({
              where: {
                eventId_userId: { eventId: item.eventId, userId: user.id },
              },
              update: {
                accessLevel: item.accessLevel,
                assignedBy: safeAssignedBy,
              },
              create: {
                eventId: item.eventId,
                userId: user.id,
                accessLevel: item.accessLevel,
                assignedBy: safeAssignedBy,
              },
            });
          }
        });

        const updated = await prisma.eventStaff.findMany({
          where: { userId: user.id },
          include: {
            event: { select: { id: true, title: true, slug: true, status: true, location: true } },
          },
        });

        res.json({ ok: true, data: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  // Eliminar usuario
  router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
    try {
      if (req.user?.id === req.params.id) {
        throw new DomainError('VALIDATION_ERROR', 'No podés eliminar tu propia cuenta');
      }
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado');

      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Usuario eliminado' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
