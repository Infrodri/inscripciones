import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import type { FileStorage } from '@inscripciones/infrastructure/fileStorage.js';
import { renderCertificates, type CertificateJob } from '@inscripciones/infrastructure/pdf.js';
import { fontPaths } from '../../shared/fonts.js';
import { logger } from '../../shared/logger.js';
import { formatPrintedName } from '../../domain/nameFormat.js';
import { attendancePercentage } from '../../application/attendanceService.js';

function lazyCode(): string {
  return randomBytes(9).toString('base64url');
}

type NameBox = {
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

// Exportación por rol. ASISTENTE sale de inscritos; los roles manuales de
// certificate_recipients (cada uno con su plantilla). Un certificado por
// página, en streaming. `certificate_code` perezoso, no se imprime.
export function certificateExportRoutes(privateStorage: FileStorage): Router {
  const router = Router();
  router.get(
    '/events/:id/exports/certificates.pdf',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const query = z
          .object({
            roleKind: z.enum(['ASISTENTE', 'EXPOSITOR', 'ORGANIZADOR', 'OTRO']),
            scope: z.enum(['eligible', 'all', 'selected']).default('eligible'),
            templateId: z.string().uuid().optional(),
            ids: z.string().optional(),
            printBackground: z
              .preprocess((val) => (val === 'false' || val === false ? false : true), z.boolean())
              .default(true),
          })
          .parse(req.query);
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({
          where: { id: req.params.id },
          include: { sessions: true },
        });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        if (req.user?.role === 'STAFF' && event.createdBy !== req.user.id) {
          throw new DomainError(
            'FORBIDDEN',
            'No tiene permiso para exportar certificados de este evento'
          );
        }
        const images = new Map<string, Buffer>();
        async function imageFor(filePath: string): Promise<Buffer> {
          const cached = images.get(filePath);
          if (cached) return cached;
          const buffer = await privateStorage.read(filePath);
          images.set(filePath, buffer);
          return buffer;
        }
        const fonts = fontPaths();
        const jobs: CertificateJob[] = [];
        if (query.roleKind === 'ASISTENTE') {
          const template = query.templateId
            ? await prisma.certificateTemplate.findUnique({ where: { id: query.templateId } })
            : await prisma.certificateTemplate.findFirst({
                where: { eventId: event.id, roleKind: 'ASISTENTE', isDefault: true },
              });
          if (!template) {
            throw new DomainError(
              'NO_DEFAULT_TEMPLATE',
              'No hay plantilla predeterminada para ASISTENTE'
            );
          }
          if (template.eventId !== event.id || template.roleKind !== 'ASISTENTE') {
            throw new DomainError(
              'TEMPLATE_ROLE_MISMATCH',
              'La plantilla no pertenece a este evento y rol'
            );
          }
          let participants = await prisma.participant.findMany({
            where: { eventId: event.id },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          });
          if (query.scope === 'selected') {
            const ids = new Set((query.ids ?? '').split(',').filter(Boolean));
            participants = participants.filter((p) => ids.has(p.id));
          }
          if (query.scope === 'eligible') {
            const total = event.sessions.length;
            const eligible: typeof participants = [];
            for (const participant of participants) {
              const attended = await prisma.attendance.count({
                where: { participantId: participant.id, voidedAt: null },
              });
              if (
                event.issuesCertificate &&
                attendancePercentage(attended, total) >= event.minAttendancePercent
              ) {
                eligible.push(participant);
              }
            }
            participants = eligible;
          }
          const image = await imageFor(template.filePath);
          const nameBox = template.nameBox as unknown as NameBox;
          for (const participant of participants) {
            if (!participant.certificateCode) {
              await prisma.participant.update({
                where: { id: participant.id },
                data: { certificateCode: lazyCode() },
              });
            }
            jobs.push({
              image,
              widthPx: template.widthPx,
              pageWidthMm: template.pageWidthMm,
              pageHeightMm: template.pageHeightMm,
              name: formatPrintedName(
                `${participant.firstName} ${participant.lastName}`,
                nameBox.nameCase
              ),
              nameBox,
              printBackground: query.printBackground,
            });
          }
        } else {
          let recipients = await prisma.certificateRecipient.findMany({
            where: { eventId: event.id, roleKind: query.roleKind },
            include: { template: true },
            orderBy: { createdAt: 'asc' },
          });
          if (query.templateId)
            recipients = recipients.filter((r) => r.templateId === query.templateId);
          if (query.scope === 'selected') {
            const ids = new Set((query.ids ?? '').split(',').filter(Boolean));
            recipients = recipients.filter((r) => ids.has(r.id));
          }
          for (const recipient of recipients) {
            if (!recipient.certificateCode) {
              await prisma.certificateRecipient.update({
                where: { id: recipient.id },
                data: { certificateCode: lazyCode() },
              });
            }
            const template = recipient.template;
            const nameBox = template.nameBox as unknown as NameBox;
            jobs.push({
              image: await imageFor(template.filePath),
              widthPx: template.widthPx,
              pageWidthMm: template.pageWidthMm,
              pageHeightMm: template.pageHeightMm,
              name: formatPrintedName(recipient.fullName, nameBox.nameCase),
              nameBox,
              printBackground: query.printBackground,
            });
          }
        }
        res.header('Content-Type', 'application/pdf');
        res.header(
          'Content-Disposition',
          `attachment; filename="certificados-${query.roleKind.toLowerCase()}-${event.slug}.pdf"`
        );
        const report = await renderCertificates(jobs, fonts, res);
        logger.info('certificates_exported', {
          eventId: event.id,
          roleKind: query.roleKind,
          generated: report.generated,
          shrunk: report.shrunk,
          overflow: report.overflow.length,
          lowDpi: report.lowDpi,
        });
      } catch (err) {
        next(err);
      }
    }
  );
  return router;
}
