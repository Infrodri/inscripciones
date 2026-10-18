import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getPrisma } from '../../infrastructure/prisma.js';
import { DomainError } from '../../domain/errors.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { normalizeCi } from '../../shared/normalize.js';
import { qrPngBuffer } from '@inscripciones/infrastructure/qr.js';
import { assertSessionWindow } from '../../application/attendanceService.js';
import {
  issueSelfCheckinToken,
  verifySelfCheckinToken,
  windowEndsAt,
  currentWindow,
} from '../../application/selfCheckin.js';
import { logger } from '../../shared/logger.js';
import type { AppEnv } from '../env.js';
import { assertSessionAccess } from '../../application/accessControl.js';

const admin = requireRole('ADMIN', 'STAFF');

// Anti-abuso: 60/min por IP (muchos comparten el WiFi del salón).
function selfCheckinLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Demasiados intentos, espere un momento',
          details: [],
        },
      });
    },
  });
}

// 5 intentos fallidos por CI y token cada 10 min (en memoria, sin Redis).
const failedAttempts = new Map<string, number[]>();

function failedKey(token: string, ci: string): string {
  return `${token}:${ci}`;
}

function assertAttemptBudget(token: string, ci: string): void {
  const now = Date.now();
  const key = failedKey(token, ci);
  const recent = (failedAttempts.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  failedAttempts.set(key, recent);
  if (recent.length >= 5) {
    throw new DomainError('RATE_LIMITED', 'Demasiados intentos, espere unos minutos');
  }
}

function recordFailure(token: string, ci: string): void {
  const key = failedKey(token, ci);
  failedAttempts.set(key, [...(failedAttempts.get(key) ?? []), Date.now()]);
}

function maskCi(ci: string): string {
  return `${ci.slice(0, 2)}***`;
}

export function selfCheckinAdminRoutes(env: AppEnv): Router {
  const router = Router();

  router.post('/sessions/:id/self-checkin/open', admin, async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      const session = await prisma.session.update({
        where: { id: req.params.id },
        data: { selfCheckinOpen: true },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'self-checkin.open',
          entity: 'session',
          entityId: session.id,
          metadata: {},
        },
      });
      res.json({ id: session.id, selfCheckinOpen: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/sessions/:id/self-checkin/close', admin, async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      const session = await prisma.session.update({
        where: { id: req.params.id },
        data: { selfCheckinOpen: false },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'self-checkin.close',
          entity: 'session',
          entityId: session.id,
          metadata: {},
        },
      });
      res.json({ id: session.id, selfCheckinOpen: false });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sessions/:id/self-checkin/token', admin, async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      const token = issueSelfCheckinToken(env.JWT_SECRET, session.id);
      res.json({
        url: `${env.PUBLIC_SITE_URL}/a/${token}`,
        qrPngUrl: `/api/v1/sessions/${session.id}/self-checkin/qr.png`,
        expiresAt: windowEndsAt(currentWindow()),
      });
    } catch (err) {
      next(err);
    }
  });

  // PNG del QR vigente (se regenera solo: cada request usa la ventana actual).
  router.get('/sessions/:id/self-checkin/qr.png', admin, async (req: AuthRequest, res, next) => {
    try {
      const prisma = getPrisma();
      const session = await assertSessionAccess(prisma, req.user, req.params.id, 'OPERATOR');
      const token = issueSelfCheckinToken(env.JWT_SECRET, session.id);
      const png = await qrPngBuffer(`${env.PUBLIC_SITE_URL}/a/${token}`);
      res.header('Content-Type', 'image/png');
      res.send(png);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function selfCheckinPublicRoutes(env: AppEnv): Router {
  const router = Router();
  const limiter = selfCheckinLimiter();

  // Solo título y horario, sin datos personales.
  router.get('/public/self-checkin/:token', limiter, async (req, res, next) => {
    try {
      const verified = verifySelfCheckinToken(env.JWT_SECRET, req.params.token);
      if (!verified) throw new DomainError('INVALID_QR', 'El código QR no es válido');
      const prisma = getPrisma();
      const session = await prisma.session.findUnique({
        where: { id: verified.sessionId },
        include: { event: { select: { title: true, checkinWindowMinutes: true } } },
      });
      if (!session) throw new DomainError('INVALID_QR', 'El código QR no es válido');
      res.json({
        title: session.event.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        open: session.selfCheckinOpen,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/public/self-checkin',
    limiter,
    validateBody(z.object({ token: z.string().min(1), ci: z.string().min(1) })),
    async (req, res, next) => {
      const ci = normalizeCi(String(req.body.ci));
      const token = String(req.body.token);
      try {
        assertAttemptBudget(token, ci);
        const verified = verifySelfCheckinToken(env.JWT_SECRET, token);
        if (!verified) throw new DomainError('INVALID_QR', 'El código QR no es válido');
        const prisma = getPrisma();
        const session = await prisma.session.findUnique({
          where: { id: verified.sessionId },
          include: { event: true },
        });
        if (!session) throw new DomainError('INVALID_QR', 'El código QR no es válido');
        if (!session.selfCheckinOpen) {
          throw new DomainError('SESSION_NOT_ACTIVE', 'El registro por QR no está abierto');
        }
        assertSessionWindow(new Date(), {
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          checkinWindowMinutes: session.event.checkinWindowMinutes,
        });
        const participant = await prisma.participant.findUnique({
          where: { eventId_ci: { eventId: session.eventId, ci } },
        });
        if (!participant) {
          throw new DomainError('NOT_ENROLLED', 'Ese CI no está inscrito en este evento');
        }
        const previous = await prisma.attendance.findUnique({
          where: {
            participantId_sessionId: { participantId: participant.id, sessionId: session.id },
          },
        });
        if (previous && !previous.voidedAt) {
          throw new DomainError(
            'ALREADY_CHECKED_IN',
            `Ya se registró la asistencia de ${participant.firstName} ${participant.lastName}`,
            [{ scannedAt: previous.scannedAt }]
          );
        }
        const attendance = previous
          ? previous
          : await prisma.attendance.create({
              data: { participantId: participant.id, sessionId: session.id, method: 'SELF_QR' },
            });
        res.status(201).json({
          firstName: participant.firstName,
          lastInitial: `${participant.lastName.charAt(0)}.`,
          scannedAt: attendance.scannedAt,
        });
      } catch (err) {
        if (err instanceof DomainError) {
          recordFailure(token, ci);
          logger.warn('self_checkin_failed', { code: err.code, ci: maskCi(ci) });
        }
        next(err);
      }
    }
  );

  return router;
}
