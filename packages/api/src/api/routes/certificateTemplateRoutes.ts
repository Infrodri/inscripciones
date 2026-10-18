import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { FileStorage } from '@inscripciones/infrastructure/fileStorage.js';
import { detectPageSize } from '@inscripciones/infrastructure/certificates.js';
import { renderCertificates } from '@inscripciones/infrastructure/pdf.js';
import { fontPaths } from '../../shared/fonts.js';
import { formatPrintedName } from '../../domain/nameFormat.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const nameBoxSchema = z.object({
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  wPct: z.number().min(1).max(100),
  hPct: z.number().min(1).max(100),
  fontKey: z.enum(['sans', 'serif', 'script']),
  sizePt: z.number().min(6).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(['left', 'center', 'right']),
  nameCase: z.enum(['UPPER', 'TITLE', 'AS_TYPED']),
  autoShrink: z.literal(true),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  nameBox: nameBoxSchema.optional(),
  isShared: z.boolean().optional(),
});

async function validateTemplateImage(
  buffer: Buffer,
  mimetype: string
): Promise<{ width: number; height: number }> {
  if (!['image/png', 'image/jpeg'].includes(mimetype)) {
    throw new DomainError('UNSUPPORTED_FILE', 'La plantilla debe ser PNG o JPG');
  }
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height || !meta.format) {
      throw new DomainError('TEMPLATE_INVALID', 'La imagen de la plantilla no es válida');
    }
    return { width: meta.width, height: meta.height };
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError('TEMPLATE_INVALID', 'La imagen de la plantilla no es válida');
  }
}

export function certificateTemplateRoutes(privateStorage: FileStorage): Router {
  const router = Router();
  // Solo ADMIN por ruta (las plantillas son privadas). Ni app.use ni
  // router.use sirven aquí: rechazarían el STAFF de rutas montadas después.
  const admin = requireRole('ADMIN');

  router.get(
    '/events/:eventId/certificate-templates',
    requireRole('ADMIN', 'STAFF'),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const roleKind = typeof req.query.roleKind === 'string' ? req.query.roleKind : undefined;
        const items = await prisma.certificateTemplate.findMany({
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
    }
  );

  // Subida: imagen PNG/JPG (máx. 15 MB) + rol. Multipart trae todo como
  // texto: nameBox llega como JSON serializado y se parsea aquí.
  router.post(
    '/events/:eventId/certificate-templates/upload',
    admin,
    upload.single('file'),
    async (req, res, next) => {
      try {
        if (!req.file) throw new DomainError('VALIDATION_ERROR', 'Debe adjuntar la imagen');
        const parsed = z
          .object({
            name: z.string().min(1),
            roleKind: z.enum(['ASISTENTE', 'EXPOSITOR', 'ORGANIZADOR', 'OTRO']),
            nameBox: z.preprocess(
              (value) => (typeof value === 'string' ? JSON.parse(value) : value),
              nameBoxSchema
            ),
            pageWidthMm: z.coerce.number().optional(),
            pageHeightMm: z.coerce.number().optional(),
          })
          .safeParse(req.body);
        if (!parsed.success) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Los datos enviados no son válidos',
            parsed.error.issues
          );
        }
        const { width, height } = await validateTemplateImage(req.file.buffer, req.file.mimetype);
        const detected = detectPageSize(width, height);
        const prisma = getPrisma();
        const key = `templates/${req.params.eventId}/${randomUUID()}.jpg`;
        const image = await sharp(req.file.buffer).jpeg({ quality: 92 }).toBuffer();
        await privateStorage.save(image, key, 'image/jpeg');
        const created = await prisma.certificateTemplate.create({
          data: {
            eventId: req.params.eventId,
            roleKind: parsed.data.roleKind,
            name: parsed.data.name,
            filePath: key,
            widthPx: width,
            heightPx: height,
            pageWidthMm: parsed.data.pageWidthMm ?? detected.pageWidthMm,
            pageHeightMm: parsed.data.pageHeightMm ?? detected.pageHeightMm,
            nameBox: parsed.data.nameBox,
          },
        });
        res.status(201).json({ template: created, page: detected });
      } catch (err) {
        const fileErr = err as { code?: string };
        if (fileErr?.code === 'LIMIT_FILE_SIZE') {
          next(new DomainError('FILE_TOO_LARGE', 'La plantilla supera los 15 MB'));
          return;
        }
        next(err);
      }
    }
  );

  router.patch(
    '/certificate-templates/:id',
    admin,
    validateBody(templateUpdateSchema),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const updated = await prisma.certificateTemplate.update({
          where: { id: req.params.id },
          data: req.body,
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post('/certificate-templates/:id/set-default', admin, async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const template = await prisma.certificateTemplate.findUnique({
        where: { id: req.params.id },
      });
      if (!template) throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
      await prisma.$transaction([
        prisma.certificateTemplate.updateMany({
          where: { eventId: template.eventId, roleKind: template.roleKind, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.certificateTemplate.update({
          where: { id: template.id },
          data: { isDefault: true },
        }),
      ]);
      res.json({ id: template.id, isDefault: true });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/certificate-templates/:id/duplicate',
    admin,
    validateBody(z.object({ name: z.string().min(1) })),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const source = await prisma.certificateTemplate.findUnique({
          where: { id: req.params.id },
        });
        if (!source) throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
        const copy = await prisma.certificateTemplate.create({
          data: {
            eventId: source.eventId,
            roleKind: source.roleKind,
            name: req.body.name,
            filePath: source.filePath,
            widthPx: source.widthPx,
            heightPx: source.heightPx,
            pageWidthMm: source.pageWidthMm,
            pageHeightMm: source.pageHeightMm,
            nameBox: source.nameBox ?? {},
            isDefault: false,
          },
        });
        res.status(201).json(copy);
      } catch (err) {
        next(err);
      }
    }
  );

  // Archivo de plantilla (ADMIN y STAFF para previsualización).
  router.get(
    '/certificate-templates/:id/file',
    requireRole('ADMIN', 'STAFF'),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const template = await prisma.certificateTemplate.findUnique({
          where: { id: req.params.id },
        });
        if (!template) throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
        const buffer = await privateStorage.read(template.filePath);
        res.header('Content-Type', 'image/jpeg');
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  // Plantillas compartidas por otros eventos (solo ADMIN; STAFF no ve otros eventos).
  router.get('/certificate-templates/shared', admin, async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const items = await prisma.certificateTemplate.findMany({
        where: { isShared: true },
        include: { event: { select: { id: true, title: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  });

  // Importar: crea una COPIA independiente en el evento actual (misma imagen
  // y caja, sin heredar is_default). Solo plantillas marcadas como compartidas.
  router.post(
    '/events/:eventId/certificate-templates/import',
    admin,
    validateBody(z.object({ sourceTemplateId: z.string().uuid() })),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const source = await prisma.certificateTemplate.findUnique({
          where: { id: req.body.sourceTemplateId },
        });
        if (!source || !source.isShared || source.eventId === req.params.eventId) {
          throw new DomainError('NOT_FOUND', 'Plantilla no encontrada o no compartida');
        }
        const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        const copy = await prisma.certificateTemplate.create({
          data: {
            eventId: event.id,
            roleKind: source.roleKind,
            name: source.name,
            filePath: source.filePath,
            widthPx: source.widthPx,
            heightPx: source.heightPx,
            pageWidthMm: source.pageWidthMm,
            pageHeightMm: source.pageHeightMm,
            nameBox: source.nameBox ?? {},
            isDefault: false,
            isShared: false,
          },
        });
        res.status(201).json(copy);
      } catch (err) {
        next(err);
      }
    }
  );

  // Eliminar: no borra el archivo si otra plantilla aún lo referencia.
  router.delete('/certificate-templates/:id', admin, async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const template = await prisma.certificateTemplate.findUnique({
        where: { id: req.params.id },
      });
      if (!template) throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
      await prisma.certificateTemplate.delete({ where: { id: template.id } });
      const remaining = await prisma.certificateTemplate.count({
        where: { filePath: template.filePath },
      });
      if (remaining === 0) {
        await privateStorage.remove(template.filePath).catch(() => undefined);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Vista previa de 1 página antes del lote (ADMIN y STAFF).
  router.get(
    '/certificate-templates/:id/preview.pdf',
    requireRole('ADMIN', 'STAFF'),
    async (req, res, next) => {
      try {
        const prisma = getPrisma();
        const template = await prisma.certificateTemplate.findUnique({
          where: { id: req.params.id },
        });
        if (!template) throw new DomainError('NOT_FOUND', 'Plantilla no encontrada');
        const sampleName =
          typeof req.query.sampleName === 'string' && req.query.sampleName !== ''
            ? req.query.sampleName
            : 'Nombre de muestra';
        const image = await privateStorage.read(template.filePath);
        const nameBox = template.nameBox as unknown as {
          xPct: number;
          yPct: number;
          wPct: number;
          hPct: number;
          fontKey: 'sans' | 'serif' | 'script';
          sizePt: number;
          color: string;
          align: 'left' | 'center' | 'right';
          nameCase: 'UPPER' | 'TITLE' | 'AS_TYPED';
          autoShrink: true;
        };
        res.header('Content-Type', 'application/pdf');
        await renderCertificates(
          [
            {
              image,
              widthPx: template.widthPx,
              pageWidthMm: template.pageWidthMm,
              pageHeightMm: template.pageHeightMm,
              name: formatPrintedName(sampleName, nameBox.nameCase),
              nameBox,
            },
          ],
          fontPaths(),
          res
        );
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
