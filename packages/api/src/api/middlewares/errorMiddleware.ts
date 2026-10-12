import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../domain/errors.js';

const PRISMA_UNIQUE = 'P2002';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof DomainError) {
    const status = statusFor(err.code);
    res
      .status(status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE) {
    res.status(409).json({
      error: { code: 'DUPLICATE_REGISTRATION', message: 'El registro ya existe', details: [] },
    });
    return;
  }
  const code = (err as { code?: unknown }).code;
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
    const status = code === 'UNAUTHORIZED' ? 401 : 403;
    const message =
      code === 'UNAUTHORIZED' ? 'No autenticado' : 'No tiene permiso para esta acción';
    res.status(status).json({ error: { code, message, details: [] } });
    return;
  }
  res.status(500).json({
    error: { code: 'VALIDATION_ERROR', message: 'Ocurrió un error inesperado', details: [] },
  });
}

function statusFor(code: string): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'REGISTRATION_CLOSED':
    case 'CAPACITY_REACHED':
    case 'DUPLICATE_REGISTRATION':
    case 'ALREADY_CHECKED_IN':
    case 'DUPLICATE_RECIPIENT':
      return 409;
    case 'SESSION_NOT_ACTIVE':
    case 'INVALID_QR':
      return 422;
    case 'UNSUPPORTED_FILE':
    case 'FILE_TOO_LARGE':
    case 'TEMPLATE_INVALID':
    case 'TEMPLATE_ROLE_MISMATCH':
    case 'NO_DEFAULT_TEMPLATE':
      return 422;
    default:
      return 400;
  }
}
