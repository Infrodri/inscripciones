import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { normalizeName } from '../../shared/normalize.js';
import { assertEventAccess } from '../../application/accessControl.js';

const staffOrAdmin = requireRole('ADMIN', 'STAFF');
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

// Receptores manuales (EXPOSITOR, ORGANIZADOR, OTRO).
export function certificateRecipientRoutes(): Router {
  const router = Router();

  const getRecipientsHandler = async (req: AuthRequest, res: any, next: any) => {
    try {
      const prisma = getPrisma();
      await assertEventAccess(prisma, req.user, req.params.eventId, 'OPERATOR');
      const roleKind = typeof req.query.roleKind === 'string' ? req.query.roleKind : undefined;
      const items = await prisma.certificateRecipient.findMany({
        where: {
          eventId: req.params.eventId,
          ...(roleKind ? { roleKind: roleKind as never } : {}),
        },
        include: {
          speaker: {
            select: {
              id: true,
              fullName: true,
              titleProfession: true,
              role: true,
              institution: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  };

  router.get('/events/:eventId/certificate-recipients', staffOrAdmin, getRecipientsHandler);
  router.get('/certificate-recipients/event/:eventId', staffOrAdmin, getRecipientsHandler);

  router.post(
    '/events/:eventId/certificate-recipients',
    staffOrAdmin,
    validateBody(recipientSchema),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        await assertEventAccess(prisma, req.user, req.params.eventId, 'MANAGER');
        const fullName = normalizeName(req.body.fullName);
        await assertTemplateRole(req.params.eventId, req.body.roleKind, req.body.templateId);
        await assertNoDuplicate(req.params.eventId, req.body.templateId, fullName);
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

  router.delete(
    '/certificate-recipients/:id',
    staffOrAdmin,
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const recipient = await prisma.certificateRecipient.findUnique({
          where: { id: req.params.id },
        });
        if (!recipient) throw new DomainError('NOT_FOUND', 'Receptor no encontrado');
        await assertEventAccess(prisma, req.user, recipient.eventId, 'MANAGER');
        await prisma.certificateRecipient.delete({ where: { id: req.params.id } });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/certificate-recipients/:id',
    staffOrAdmin,
    validateBody(
      z.object({
        fullName: z.string().min(1).optional(),
        email: z.preprocess(
          (value) => (typeof value !== 'string' || value.trim() === '' ? undefined : value),
          z.string().trim().toLowerCase().pipe(z.string().email('El correo no es válido')).optional().nullable()
        ),
        note: z.string().nullable().optional(),
        templateId: z.string().uuid().optional(),
      })
    ),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const recipient = await prisma.certificateRecipient.findUnique({
          where: { id: req.params.id },
        });
        if (!recipient) throw new DomainError('NOT_FOUND', 'Receptor no encontrado');
        await assertEventAccess(prisma, req.user, recipient.eventId, 'MANAGER');

        const data: {
          fullName?: string;
          email?: string | null;
          note?: string | null;
          templateId?: string;
        } = {};

        if (req.body.fullName) data.fullName = normalizeName(req.body.fullName);
        if (req.body.email !== undefined) data.email = req.body.email;
        if (req.body.note !== undefined) data.note = req.body.note?.trim() || null;
        if (req.body.templateId) {
          await assertTemplateRole(recipient.eventId, recipient.roleKind, req.body.templateId);
          data.templateId = req.body.templateId;
        }

        const updated = await prisma.certificateRecipient.update({
          where: { id: req.params.id },
          data,
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // Alta masiva: un nombre por línea conceptual; reporta creados y duplicados.
  router.post(
    '/events/:eventId/certificate-recipients/bulk',
    staffOrAdmin,
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
        const prisma = getPrisma();
        await assertEventAccess(prisma, req.user, req.params.eventId, 'MANAGER');
        await assertTemplateRole(req.params.eventId, req.body.roleKind, req.body.templateId);
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
  const fromSpeakersHandler = async (req: AuthRequest, res: any, next: any) => {
    try {
      const prisma = getPrisma();
      await assertEventAccess(prisma, req.user, req.params.eventId, 'MANAGER');
      let template =
        (await prisma.certificateTemplate.findFirst({
          where: { eventId: req.params.eventId, roleKind: 'EXPOSITOR', isDefault: true },
        })) ??
        (await prisma.certificateTemplate.findFirst({
          where: { eventId: req.params.eventId, roleKind: 'EXPOSITOR' },
        }));

      if (!template) {
        // Fallback: Si el evento tiene cualquier plantilla (ej. ASISTENTE o predeterminada), clonarla para EXPOSITOR
        const base =
          (await prisma.certificateTemplate.findFirst({
            where: { eventId: req.params.eventId, isDefault: true },
          })) ??
          (await prisma.certificateTemplate.findFirst({
            where: { eventId: req.params.eventId },
          }));

        if (base) {
          template = await prisma.certificateTemplate.create({
            data: {
              eventId: req.params.eventId,
              roleKind: 'EXPOSITOR',
              name: 'Certificado de Expositor / Ponente',
              filePath: base.filePath,
              widthPx: base.widthPx,
              heightPx: base.heightPx,
              pageWidthMm: base.pageWidthMm,
              pageHeightMm: base.pageHeightMm,
              nameBox: base.nameBox as never,
              isDefault: false,
            },
          });
        } else {
          throw new DomainError(
            'NO_DEFAULT_TEMPLATE',
            'No hay plantillas de certificados configuradas para este evento. Configure el diseño gráfico en la pestaña Plantillas.'
          );
        }
      }
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
  };

  router.post(
    '/events/:eventId/certificate-recipients/from-speakers',
    staffOrAdmin,
    fromSpeakersHandler
  );
  router.post(
    '/certificate-recipients/event/:eventId/from-speakers',
    staffOrAdmin,
    fromSpeakersHandler
  );

  return router;
}
