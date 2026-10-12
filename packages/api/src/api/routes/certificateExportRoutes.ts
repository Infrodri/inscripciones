import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
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

// Exportación ASISTENTE (automático desde inscritos). Otros roles: H6/H7.
export function certificateExportRoutes(privateStorage: FileStorage): Router {
  const router = Router();
  router.get(
    '/events/:id/exports/certificates.pdf',
    requireRole('ADMIN'),
    async (req, res, next) => {
      try {
        const query = z
          .object({
            roleKind: z.literal('ASISTENTE'),
            scope: z.enum(['eligible', 'all', 'selected']).default('eligible'),
            templateId: z.string().uuid().optional(),
            ids: z.string().optional(),
          })
          .parse(req.query);
        const prisma = getPrisma();
        const event = await prisma.event.findUnique({
          where: { id: req.params.id },
          include: { sessions: true },
        });
        if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
        const template = query.templateId
          ? await prisma.certificateTemplate.findUnique({ where: { id: query.templateId } })
          : await prisma.certificateTemplate.findFirst({
              where: { eventId: event.id, roleKind: 'ASISTENTE', isDefault: true },
            });
        if (!template)
          throw new DomainError(
            'NO_DEFAULT_TEMPLATE',
            'No hay plantilla predeterminada para ASISTENTE'
          );
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
        const image = await privateStorage.read(template.filePath);
        const nameBox = template.nameBox as unknown as NameBox;
        const fonts = fontPaths();
        const jobs: CertificateJob[] = [];
        for (const participant of participants) {
          if (!participant.certificateCode) {
            const certificateCode = lazyCode();
            await prisma.participant.update({
              where: { id: participant.id },
              data: { certificateCode },
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
          });
        }
        res.header('Content-Type', 'application/pdf');
        res.header(
          'Content-Disposition',
          `attachment; filename="certificados-asistente-${event.slug}.pdf"`
        );
        const report = await renderCertificates(jobs, fonts, res);
        logger.info('certificates_exported', {
          eventId: event.id,
          roleKind: 'ASISTENTE',
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
