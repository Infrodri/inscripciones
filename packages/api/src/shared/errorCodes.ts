import type { ErrorCode } from '../domain/errors.js';

export const ERROR_CODES: ErrorCode[] = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'REGISTRATION_CLOSED',
  'CAPACITY_REACHED',
  'DUPLICATE_REGISTRATION',
  'ALREADY_CHECKED_IN',
  'INVALID_QR',
  'SESSION_NOT_ACTIVE',
  'UNSUPPORTED_FILE',
  'FILE_TOO_LARGE',
  'TEMPLATE_INVALID',
  'TEMPLATE_ROLE_MISMATCH',
  'NO_DEFAULT_TEMPLATE',
  'DUPLICATE_RECIPIENT',
  'NOT_ENROLLED',
  'RATE_LIMITED',
];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details: unknown[] };
}
