import { Router } from 'express';
import ExcelJS from 'exceljs';
import { renderBadgeSheet } from '@inscripciones/infrastructure/badges.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { assertEventAccess } from '../../application/accessControl.js';

import type { FileStorage } from '../../infrastructure/storage.js';

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

export function exportRoutes(storage?: FileStorage): Router {
  const router = Router();
  router.get(
    '/events/:id/exports/:kind',
    requireRole('ADMIN', 'STAFF'),
    async (req: AuthRequest, res, next) => {
      try {
        const prisma = getPrisma();
        const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
        const event = await assertEventAccess(prisma, req.user, req.params.id, 'MANAGER');
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
            where: {
              session: { eventId: event.id },
              voidedAt: null,
              participant: participantWhere,
            },
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
            res.header(
              'Content-Disposition',
              `attachment; filename="asistencia-${event.slug}.csv"`
            );
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
        if (
          req.params.kind === 'badges.pdf' ||
          req.params.kind === 'speakers-badges.pdf' ||
          req.params.kind === 'organizers-badges.pdf' ||
          req.params.kind === 'sponsors-badges.pdf'
        ) {
          const target =
            typeof req.query.target === 'string'
              ? req.query.target.toLowerCase()
              : req.params.kind === 'speakers-badges.pdf'
                ? 'speakers'
                : req.params.kind === 'organizers-badges.pdf'
                  ? 'organizers'
                  : req.params.kind === 'sponsors-badges.pdf'
                    ? 'sponsors'
                    : null;

          const typeParam =
            typeof req.query.type === 'string' && req.query.type.trim() !== ''
              ? req.query.type.trim().toUpperCase()
              : null;

          let includeParticipants = true;
          let includeSpeakers = true;
          let includeOrganizers = true;
          let includeSponsors = false;

          if (
            target === 'speakers' ||
            target === 'expositores' ||
            typeParam === 'EXPOSITOR' ||
            typeParam === 'MODERADOR'
          ) {
            includeParticipants = false;
            includeSpeakers = true;
            includeOrganizers = false;
            includeSponsors = false;
          } else if (
            target === 'organizers' ||
            target === 'organizadores' ||
            target === 'organization' ||
            typeParam === 'ORGANIZADOR'
          ) {
            includeParticipants = false;
            includeSpeakers = false;
            includeOrganizers = true;
            includeSponsors = false;
          } else if (
            target === 'sponsors' ||
            target === 'auspiciantes' ||
            typeParam === 'AUSPICIANTE' ||
            typeParam === 'SPONSOR'
          ) {
            includeParticipants = false;
            includeSpeakers = false;
            includeOrganizers = false;
            includeSponsors = true;
          } else if (
            target === 'participants' ||
            (typeParam && ['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO'].includes(typeParam))
          ) {
            includeParticipants = true;
            includeSpeakers = false;
            includeOrganizers = false;
            includeSponsors = false;
          } else if (target === 'all') {
            includeParticipants = true;
            includeSpeakers = true;
            includeOrganizers = true;
            includeSponsors = true;
          } else {
            includeParticipants = true;
            includeSpeakers = true;
            includeOrganizers = true;
            includeSponsors = false;
          }

          const sessions = await prisma.session.findMany({
            where: { eventId: event.id },
            orderBy: { startsAt: 'asc' },
          });

          const datesStr =
            sessions.length > 0
              ? `${sessions[0].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}${sessions.length > 1 ? ` - ${sessions[sessions.length - 1].startsAt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ` ${sessions[0].startsAt.getFullYear()}`}`
              : null;

          let headerImageBuffer: Buffer | null = null;
          if (event.bannerPath && storage) {
            try {
              headerImageBuffer = await storage.read(event.bannerPath);
            } catch {
              headerImageBuffer = null;
            }
          }

          const [participants, speakers, organizers, sponsors] = await Promise.all([
            includeParticipants
              ? prisma.participant.findMany({
                  where: participantWhere,
                  orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
                })
              : Promise.resolve([]),
            includeSpeakers
              ? prisma.speaker.findMany({
                  where: {
                    eventId: event.id,
                    ...(typeParam === 'EXPOSITOR' || typeParam === 'MODERADOR'
                      ? { role: typeParam as 'EXPOSITOR' | 'MODERADOR' }
                      : {}),
                    ...(query
                      ? {
                          OR: [
                            { fullName: { contains: query } },
                            { institution: { contains: query } },
                            { titleProfession: { contains: query } },
                          ],
                        }
                      : {}),
                  },
                  include: { recipients: true },
                  orderBy: [{ position: 'asc' }, { fullName: 'asc' }],
                })
              : Promise.resolve([]),
            includeOrganizers
              ? prisma.certificateRecipient.findMany({
                  where: {
                    eventId: event.id,
                    roleKind: 'ORGANIZADOR',
                    ...(query
                      ? {
                          OR: [
                            { fullName: { contains: query } },
                            { email: { contains: query } },
                            { note: { contains: query } },
                          ],
                        }
                      : {}),
                  },
                  orderBy: { fullName: 'asc' },
                })
              : Promise.resolve([]),
            includeSponsors
              ? prisma.sponsor.findMany({
                  where: {
                    eventId: event.id,
                    ...(query ? { name: { contains: query } } : {}),
                  },
                  orderBy: { position: 'asc' },
                })
              : Promise.resolve([]),
          ]);

          const eventParticipantsForMatch = includeParticipants
            ? participants
            : await prisma.participant.findMany({
                where: { eventId: event.id },
                select: { id: true, firstName: true, lastName: true, ci: true, email: true, qrToken: true },
              });

          function findMatchingParticipant(
            name: string,
            email?: string | null
          ): { id: string; ci: string; qrToken: string } | null {
            const normName = name.trim().toLowerCase();
            const normEmail = email?.trim().toLowerCase();
            return (
              eventParticipantsForMatch.find((p) => {
                if (normEmail && p.email?.trim().toLowerCase() === normEmail) return true;
                const pName = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
                return pName === normName;
              }) ?? null
            );
          }

          const speakerBadges = await Promise.all(
            speakers.map(async (s) => {
              const speakerEmail = s.recipients.find((r) => r.email)?.email;
              const match = findMatchingParticipant(s.fullName, speakerEmail);
              const qrPayload = match?.qrToken ?? `SPEAKER:${s.id}:${event.slug}`;
              return {
                fullName: s.fullName.trim(),
                ci: match?.ci ?? null,
                type: s.role === 'MODERADOR' ? 'MODERADOR' : 'EXPOSITOR',
                institution: s.institution ?? s.titleProfession ?? event.institution,
                career: s.titleProfession ?? (s.role === 'MODERADOR' ? 'Moderador' : 'Expositor Invitado'),
                eventTitle: event.title,
                eventInstitution: event.institution,
                eventDates: datesStr,
                eventLocation: event.location,
                qrPngBuffer: await qrPngBuffer(qrPayload),
                headerImageBuffer: headerImageBuffer ?? undefined,
                _matchedParticipantId: match?.id,
              };
            })
          );

          const organizerBadges = await Promise.all(
            organizers.map(async (o) => {
              const match = findMatchingParticipant(o.fullName, o.email);
              const qrPayload = match?.qrToken ?? o.certificateCode ?? `ORGANIZER:${o.id}:${event.slug}`;
              return {
                fullName: o.fullName.trim(),
                ci: match?.ci ?? null,
                type: 'ORGANIZADOR',
                institution: o.note ?? event.institution ?? 'Comité Organizador',
                career: 'Comité Organizador',
                eventTitle: event.title,
                eventInstitution: event.institution,
                eventDates: datesStr,
                eventLocation: event.location,
                qrPngBuffer: await qrPngBuffer(qrPayload),
                headerImageBuffer: headerImageBuffer ?? undefined,
                _matchedParticipantId: match?.id,
              };
            })
          );

          const sponsorBadges = await Promise.all(
            sponsors.map(async (sp) => ({
              fullName: sp.name.trim(),
              ci: null,
              type: 'AUSPICIANTE',
              institution: event.institution,
              career: 'Auspiciador Oficial',
              eventTitle: event.title,
              eventInstitution: event.institution,
              eventDates: datesStr,
              eventLocation: event.location,
              qrPngBuffer: await qrPngBuffer(`SPONSOR:${sp.id}:${event.slug}`),
              headerImageBuffer: headerImageBuffer ?? undefined,
              _matchedParticipantId: undefined,
            }))
          );

          const claimedParticipantIds = new Set<string>();
          for (const b of speakerBadges) {
            if (b._matchedParticipantId) claimedParticipantIds.add(b._matchedParticipantId);
          }
          for (const b of organizerBadges) {
            if (b._matchedParticipantId) claimedParticipantIds.add(b._matchedParticipantId);
          }

          const participantBadges = await Promise.all(
            participants
              .filter((p) => !claimedParticipantIds.has(p.id))
              .map(async (p) => ({
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
                headerImageBuffer: headerImageBuffer ?? undefined,
              }))
          );

          const badgeList = [
            ...speakerBadges.map(({ _matchedParticipantId, ...rest }) => rest),
            ...organizerBadges.map(({ _matchedParticipantId, ...rest }) => rest),
            ...sponsorBadges.map(({ _matchedParticipantId, ...rest }) => rest),
            ...participantBadges,
          ];

          if (badgeList.length === 0) {
            throw new DomainError(
              'NO_PARTICIPANTS',
              'No se encontraron registros para generar credenciales'
            );
          }

          let filenameSuffix = '';
          if (target === 'speakers' || typeParam === 'EXPOSITOR' || typeParam === 'MODERADOR') {
            filenameSuffix = '-expositores';
          } else if (target === 'organizers' || typeParam === 'ORGANIZADOR') {
            filenameSuffix = '-organizadores';
          } else if (target === 'sponsors' || typeParam === 'AUSPICIANTE') {
            filenameSuffix = '-auspiciantes';
          } else if (target === 'participants') {
            filenameSuffix = '-participantes';
          }

          res.header('Content-Type', 'application/pdf');
          res.header(
            'Content-Disposition',
            `attachment; filename="credenciales${filenameSuffix}-${event.slug}.pdf"`
          );
          await renderBadgeSheet(badgeList, res);
          return;
        }
        throw new DomainError('NOT_FOUND', 'Exportación no encontrada');
      } catch (err) {
        next(err);
      }
    }
  );
  return router;
}
