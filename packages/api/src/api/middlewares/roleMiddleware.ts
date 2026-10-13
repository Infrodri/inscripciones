import type { NextFunction, Response } from 'express';
import { DomainError } from '../../domain/errors.js';
import type { AuthRequest } from './authMiddleware.js';

export function requireRole(...roles: Array<'SUPERADMIN' | 'ADMIN' | 'STAFF'>) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new DomainError('FORBIDDEN', 'No tiene permiso para esta acción'));
      return;
    }
    next();
  };
}
