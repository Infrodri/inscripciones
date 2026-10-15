import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../../infrastructure/jwtService.js';

export interface AuthRequest extends Request {
  user?: { id: string; role: 'ADMIN' | 'STAFF' };
}

export function authMiddleware(secret: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      next(Object.assign(new Error('No autenticado'), { code: 'UNAUTHORIZED' }));
      return;
    }
    try {
      const payload = verifyAccessToken(token, secret);
      req.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(Object.assign(new Error('Sesión inválida'), { code: 'UNAUTHORIZED' }));
    }
  };
}
