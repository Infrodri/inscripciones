import { DomainError } from '../domain/errors.js';

export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null || email.trim() === '') return null;
  return email.trim().toLowerCase();
}

export function normalizeCi(ci: string): string {
  return ci.replace(/\s+/g, '').trim().toUpperCase();
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// Acepta "+591", "591", espacios o guiones; normaliza a "+591XXXXXXXX".
// Vacío = null. Exige 8 dígitos que empiecen con 6 o 7.
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || phone.trim() === '') return null;
  const digits = phone
    .trim()
    .replace(/^\+?591/, '')
    .replace(/[\s-]/g, '')
    .replace(/\D/g, '');
  if (!/^[67]\d{7}$/.test(digits)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'El celular debe tener 8 dígitos que empiecen con 6 o 7'
    );
  }
  return `+591${digits}`;
}

export function normalizeParticipant(input: {
  firstName: string;
  lastName: string;
  ci: string;
  email?: string | null;
  phone?: string | null;
}): {
  firstName: string;
  lastName: string;
  ci: string;
  email: string | null;
  phone: string | null;
} {
  return {
    firstName: normalizeName(input.firstName),
    lastName: normalizeName(input.lastName),
    ci: normalizeCi(input.ci),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
  };
}
