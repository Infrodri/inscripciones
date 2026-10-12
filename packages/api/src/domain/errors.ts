export const ERROR_CODES = [
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
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown[];

  constructor(code: ErrorCode, message: string, details: unknown[] = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
