import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

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
  router.get('/events/:id/exports/:kind', requireRole('ADMIN'), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) throw new DomainError('NOT_FOUND', 'Evento no encontrado');
      if (req.params.kind === 'participants') {
        const participants = await prisma.participant.findMany({
          where: { eventId: event.id },
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
          where: { session: { eventId: event.id }, voidedAt: null },
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
      throw new DomainError('NOT_FOUND', 'Exportación no encontrada');
    } catch (err) {
      next(err);
    }
  });
  return router;
}
