import { randomBytes } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import type { EventInput } from '../domain/types.js';

export function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function generateQrToken(): string {
  return randomBytes(24).toString('base64url');
}

export function validateEventInput(input: EventInput): void {
  if (!input.title.trim()) throw new DomainError('VALIDATION_ERROR', 'El título es obligatorio');
  if (!input.slug.trim()) throw new DomainError('VALIDATION_ERROR', 'El slug es obligatorio');
  if (input.capacity !== undefined && input.capacity !== null && input.capacity < 0) {
    throw new DomainError('VALIDATION_ERROR', 'El cupo no puede ser negativo');
  }
  if (
    input.minAttendancePercent !== undefined &&
    (input.minAttendancePercent < 0 || input.minAttendancePercent > 100)
  ) {
    throw new DomainError('VALIDATION_ERROR', 'El porcentaje mínimo debe estar entre 0 y 100');
  }
}

// Duplicar: copia datos, expositores, auspiciantes y plantillas (sin inscritos ni asistencia).
// Se cambian título, slug y fecha base; las sesiones se desplazan los mismos días. EDITABLE: desplazamiento exacto.
export interface DuplicateRequest {
  title: string;
  slug: string;
  daysShift: number;
}

export function buildDuplicateSlug(slug: string): string {
  return `${slug}-copia`;
}
