import { Router } from 'express';
import ExcelJS from 'exceljs';
import { renderBadgeSheet } from '@inscripciones/infrastructure/badges.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

const PARTICIPANT_COLUMNS = [
  'first_name',
  'last_name',
  'ci',
  'email',
  'phone',
  'type',
  'institution',
  'career',
  'semester',
  'source',
  'created_at',
] as const;

function toCsv(rows: Array<Record<string, unknown>>): string {
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    PARTICIPANT_COLUMNS.join(','),
    ...rows.map((r) => PARTICIPANT_COLUMNS.map((c) => escape(r[c])).join(',')),
  ].join('\n');
}

export function exportRoutes(): Router {
  const router = Router();
  router.get('/events/:id/exports/:kind', requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      if (req.user?.role === 'STAFF' && event.createdBy !== req.user.id) {
        throw new DomainError('FORBIDDEN', 'No tiene permiso para exportar de este evento');
      }
      // Filtros de la vista previa (q, type) para que lo exportado coincida.
      const query =
        typeof req.query.q === 'string' && req.query.q.trim() !== '' ? req.query.q.trim() : null;
      const typeFilter =
        typeof req.query.type === 'string' && req.query.type !== '' ? req.query.type : null;
      const participantWhere = {
        eventId: event.id,
        ...(typeFilter ? { type: typeFilter as never } : {}),
        ...(query
          ? {
              OR: [
                { firstName: { contains: query } },
                { lastName: { contains: query } },
                { ci: { contains: query } },
                { email: { contains: query } },
              ],
            }
          : {}),
      };
      if (req.params.kind === 'participants') {
        const participants = await prisma.participant.findMany({
          where: participantWhere,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
        const rows = participants.map((p) => ({
          first_name: p.firstName,
          last_name: p.lastName,
          ci: p.ci,
          email: p.email,
          phone: p.phone,
          type: p.type,
          institution: p.institution,
          career: p.career,
          semester: p.semester,
          source: p.source,
          created_at: p.createdAt.toISOString(),
        }));
        if (format === 'csv') {
          res.header('Content-Type', 'text/csv; charset=utf-8');
          res.header('Content-Disposition', `attachment; filename="inscritos-${event.slug}.csv"`);
          res.send(`\uFEFF${toCsv(rows)}`);
          return;
        }
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inscritos');
        sheet.columns = PARTICIPANT_COLUMNS.map((c) => ({ header: c, key: c, width: 22 }));
        sheet.addRows(rows);
        const buffer = await workbook.xlsx.writeBuffer();
        res.header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.header('Content-Disposition', `attachment; filename="inscritos-${event.slug}.xlsx"`);
        res.send(Buffer.from(buffer));
        return;
      }
      if (req.params.kind === 'attendance') {
        const attendances = await prisma.attendance.findMany({
          where: { session: { eventId: event.id }, voidedAt: null, participant: participantWhere },
          include: { participant: true, session: true },
          orderBy: [{ session: { startsAt: 'asc' } }, { participant: { lastName: 'asc' } }],
        });
        const rows = attendances.map((a) => ({
          first_name: a.participant.firstName,
          last_name: a.participant.lastName,
          ci: a.participant.ci,
          email: a.participant.email,
          phone: a.participant.phone,
          type: a.participant.type,
          institution: a.participant.institution,
          career: a.participant.career,
          semester: a.participant.semester,
          source: `${a.session.label ?? a.session.startsAt.toISOString()} | ${a.method} | ${a.scannedAt.toISOString()}`,
          created_at: a.scannedAt.toISOString(),
        }));
        if (format === 'csv') {
          res.header('Content-Type', 'text/csv; charset=utf-8');
          res.header('Content-Disposition', `attachment; filename="asistencia-${event.slug}.csv"`);
          res.send(`\uFEFF${toCsv(rows)}`);
          return;
        }
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Asistencia');
        sheet.columns = PARTICIPANT_COLUMNS.map((c) => ({ header: c, key: c, width: 22 }));
        sheet.addRows(rows);
        const buffer = await workbook.xlsx.writeBuffer();
        res.header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.header('Content-Disposition', `attachment; filename="asistencia-${event.slug}.xlsx"`);
        res.send(Buffer.from(buffer));
        return;
      }
      if (req.params.kind === 'badges.pdf') {
        const [participants, sessions] = await Promise.all([
          prisma.participant.findMany({
            where: participantWhere,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          }),
          prisma.session.findMany({
            where: { eventId: event.id },
            orderBy: { startsAt: 'asc' },
          }),
        ]);
        if (participants.length === 0) {
          throw new DomainError('NO_PARTICIPANTS', 'No hay participantes registrados para generar credenciales');
        }
        const datesStr = sessions.length > 0
          ? `${sessions[0].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}${sessions.length > 1 ? ` - ${sessions[sessions.length - 1].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ` ${sessions[0].startsAt.getFullYear()}`}`
          : null;
        const badgeList = await Promise.all(
          participants.map(async (p) => ({
            fullName: `${p.firstName} ${p.lastName}`.trim(),
            ci: p.ci,
            type: p.type,
            institution: p.institution,
            career: p.career,
            eventTitle: event.title,
            eventInstitution: event.institution,
            eventDates: datesStr,
            eventLocation: event.location,
            qrPngBuffer: await qrPngBuffer(p.qrToken),
          }))
        );
        res.header('Content-Type', 'application/pdf');
        res.header(
          'Content-Disposition',
          `attachment; filename="credenciales-${event.slug}.pdf"`
        );
        await renderBadgeSheet(badgeList, res);
        return;
      }
      throw new DomainError('NOT_FOUND', 'Exportación no encontrada');
    } catch (err) {
      next(err);
    }
  });
  return router;
}
