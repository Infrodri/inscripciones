import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { DomainError } from '../../domain/errors.js';

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new DomainError(
          'VALIDATION_ERROR',
          'Los datos enviados no son válidos',
          parsed.error.issues
        )
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}
