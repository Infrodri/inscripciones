import { DomainError } from '../domain/errors.js';
import { normalizeParticipant } from '../shared/normalize.js';
import { generateQrToken } from './eventService.js';

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  ci: string;
  email?: string | null;
  phone?: string | null;
  type: 'ESTUDIANTE' | 'DOCENTE' | 'PROFESIONAL' | 'PUBLICO';
  institution?: string | null;
  career?: string | null;
  semester?: string | null;
}

export interface RegistrationEvent {
  status: string;
  capacity: number | null;
  registrationDeadline: Date | null;
}

export function assertRegistrationOpen(event: RegistrationEvent, now: Date): void {
  if (event.status !== 'ABIERTO') {
    throw new DomainError('REGISTRATION_CLOSED', 'La inscripción a este evento está cerrada');
  }
  if (event.registrationDeadline && now > event.registrationDeadline) {
    throw new DomainError('REGISTRATION_CLOSED', 'El plazo de inscripción ya terminó');
  }
}

export function assertCapacity(registered: number, capacity: number | null): void {
  if (capacity !== null && registered >= capacity) {
    throw new DomainError('CAPACITY_REACHED', 'El evento ya alcanzó su cupo máximo');
  }
}

export function buildParticipantRow(
  eventId: string,
  input: RegistrationInput,
  source: 'ONLINE' | 'WALK_IN' = 'ONLINE'
) {
  const normalized = normalizeParticipant(input);
  return {
    eventId,
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    ci: normalized.ci,
    email: normalized.email,
    phone: normalized.phone,
    type: input.type,
    institution: input.institution?.trim() || null,
    career: input.career?.trim() || null,
    semester: input.semester?.trim() || null,
    qrToken: generateQrToken(),
    dataConsentAt: new Date(),
    source,
  };
}
