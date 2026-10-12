import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { requireRole } from '../src/api/middlewares/roleMiddleware.js';
import { errorMiddleware } from '../src/api/middlewares/errorMiddleware.js';
import { DomainError } from '../src/domain/errors.js';

function mockRes() {
  const res = { statusCode: 0, body: null as unknown };
  return {
    res: {
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return { json: vi.fn((body: unknown) => (res.body = body)) };
      }),
    },
    state: res,
  };
}

describe('requireRole', () => {
  it('STAFF no accede a rutas ADMIN', () => {
    const next = vi.fn();
    requireRole('ADMIN')({ user: { id: '1', role: 'STAFF' } } as never, {} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as DomainError).code).toBe('FORBIDDEN');
  });
  it('ADMIN sí accede', () => {
    const next = vi.fn();
    requireRole('ADMIN')({ user: { id: '1', role: 'ADMIN' } } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('errorMiddleware', () => {
  it('DomainError usa el envelope único en español', () => {
    const { res, state } = mockRes();
    errorMiddleware(
      new DomainError('NOT_FOUND', 'Evento no encontrado'),
      {} as never,
      res as never,
      (() => undefined) as never
    );
    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Evento no encontrado', details: [] },
    });
  });
  it('P2002 de Prisma se mapea a DUPLICATE_REGISTRATION sin exponer el stack', () => {
    const { res, state } = mockRes();
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    errorMiddleware(prismaError, {} as never, res as never, (() => undefined) as never);
    expect(state.statusCode).toBe(409);
    expect((state.body as { error: { code: string } }).error.code).toBe('DUPLICATE_REGISTRATION');
  });
});
