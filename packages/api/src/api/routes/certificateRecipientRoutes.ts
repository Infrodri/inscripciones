import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { normalizeName } from '../../shared/normalize.js';

const admin = requireRole('ADMIN');
const MANUAL_ROLES = ['EXPOSITOR', 'ORGANIZADOR', 'OTRO'] as const;

const recipientSchema = z.object({
  roleKind: z.enum(MANUAL_ROLES),
  fullName: z.string().min(1),
  email: z.preprocess(
    (value) => (typeof value !== 'string' || value.trim() === '' ? undefined : value),
    z.string().trim().toLowerCase().pipe(z.string().email('El correo no es válido')).optional()
  ),
  templateId: z.string().uuid(),
  speakerId: z.string().uuid().nullable().optional(),
  note: z.string().nullable().optional(),
});

async function assertTemplateRole(
  eventId: string,
  roleKind: string,
  templateId: string
): Promise<void> {
  const prisma = getPrisma();
  const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.eventId !== eventId) {
    throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
  }
  if (template.roleKind !== roleKind) {
    throw new DomainError('TEMPLATE_ROLE_MISMATCH', 'La plantilla no pertenece al rol indicado');
  }
}

async function assertNoDuplicate(
  eventId: string,
  templateId: string,
  fullName: string
): Promise<void> {
  const prisma = getPrisma();
  const normalized = normalizeName(fullName).toLowerCase();
  const existing = await prisma.certificateRecipient.findMany({
    where: { eventId, templateId },
    select: { fullName: true },
  });
  if (existing.some((r) => normalizeName(r.fullName).toLowerCase() === normalized)) {
    throw new DomainError(
      'DUPLICATE_RECIPIENT',
      'Ya existe un receptor con ese nombre para esta plantilla'
    );
  }
}

// Receptores manuales (EXPOSITOR, ORGANIZADOR, OTRO). Solo ADMIN, por ruta.
export function certificateRecipientRoutes(): Router {
  const router = Router();

  router.get('/events/:eventId/certificate-recipients', requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const roleKind = typeof req.query.roleKind === 'string' ? req.query.roleKind : undefined;
      const items = await prisma.certificateRecipient.findMany({
        where: {
          eventId: req.params.eventId,
          ...(roleKind ? { roleKind: roleKind as never } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/events/:eventId/certificate-recipients',
    admin,
    validateBody(recipientSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const fullName = normalizeName(req.body.fullName);
        await assertTemplateRole(req.params.eventId, req.body.roleKind, req.body.templateId);
        await assertNoDuplicate(req.params.eventId, req.body.templateId, fullName);
        const prisma = getPrisma();
        const created = await prisma.certificateRecipient.create({
          data: {
            eventId: req.params.eventId,
            roleKind: req.body.roleKind,
            fullName,
            email: req.body.email ?? null,
            templateId: req.body.templateId,
            speakerId: req.body.speakerId ?? null,
            note: req.body.note?.trim() || null,
            createdBy: req.user?.id,
          },
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete('/certificate-recipients/:id', admin, async (req, res, next) => {
    try {
      const prisma = getPrisma();
      await prisma.certificateRecipient.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Alta masiva: un nombre por línea conceptual; reporta creados y duplicados.
  router.post(
    '/events/:eventId/certificate-recipients/bulk',
    admin,
    validateBody(
      z.object({
        roleKind: z.enum(MANUAL_ROLES),
        templateId: z.string().uuid(),
        items: z
          .array(z.object({ fullName: z.string().min(1), note: z.string().nullable().optional() }))
          .min(1),
      })
    ),
    async (req: AuthRequest, res, next) => {
      try {
        await assertTemplateRole(req.params.eventId, req.body.roleKind, req.body.templateId);
        const prisma = getPrisma();
        const created: unknown[] = [];
        const duplicates: string[] = [];
        for (const item of req.body.items) {
          const fullName = normalizeName(item.fullName);
          try {
            await assertNoDuplicate(req.params.eventId, req.body.templateId, fullName);
            created.push(
              await prisma.certificateRecipient.create({
                data: {
                  eventId: req.params.eventId,
                  roleKind: req.body.roleKind,
                  fullName,
                  templateId: req.body.templateId,
                  note: item.note?.trim() || null,
                  createdBy: req.user?.id,
                },
              })
            );
          } catch (err) {
            if (err instanceof DomainError && err.code === 'DUPLICATE_RECIPIENT')
              duplicates.push(fullName);
            else throw err;
          }
        }
        res.status(201).json({ created, duplicates });
      } catch (err) {
        next(err);
      }
    }
  );

  // Carga desde expositores del evento (EXPOSITOR y MODERADOR) con la
  // plantilla default de EXPOSITOR; el admin ajusta antes de confirmar.
  router.post(
    '/events/:eventId/certificate-recipients/from-speakers',
    admin,
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const template = await prisma.certificateTemplate.findFirst({
          where: { eventId: req.params.eventId, roleKind: 'EXPOSITOR', isDefault: true },
        });
        if (!template)
          throw new DomainError(
            'NO_DEFAULT_TEMPLATE',
            'No hay plantilla predeterminada para EXPOSITOR'
          );
        const speakers = await prisma.speaker.findMany({
          where: { eventId: req.params.eventId },
          orderBy: { position: 'asc' },
        });
        const created: unknown[] = [];
        const skipped: string[] = [];
        for (const speaker of speakers) {
          const fullName = normalizeName(speaker.fullName);
          const exists = await prisma.certificateRecipient.findMany({
            where: { eventId: req.params.eventId, templateId: template.id },
            select: { fullName: true },
          });
          if (
            exists.some((r) => normalizeName(r.fullName).toLowerCase() === fullName.toLowerCase())
          ) {
            skipped.push(fullName);
            continue;
          }
          created.push(
            await prisma.certificateRecipient.create({
              data: {
                eventId: req.params.eventId,
                roleKind: 'EXPOSITOR',
                fullName,
                templateId: template.id,
                speakerId: speaker.id,
                createdBy: req.user?.id,
              },
            })
          );
        }
        res.status(201).json({ created, skipped });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
