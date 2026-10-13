export type RegistrationReason =
  | 'ABIERTAS'
  | 'CERRADAS_MANUAL'
  | 'CERRADA_FECHA'
  | 'CUPO_LLENO'
  | 'BORRADOR'
  | 'FINALIZADO';

export interface RegistrationStateInput {
  status: string;
  capacity: number | null;
  registrationDeadline: Date | null;
}

export const REGISTRATION_REASON_TEXT: Record<RegistrationReason, string> = {
  ABIERTAS: 'Abiertas',
  CERRADAS_MANUAL: 'Cerradas manualmente',
  CERRADA_FECHA: 'Cerradas por fecha límite',
  CUPO_LLENO: 'Cupo lleno',
  BORRADOR: 'Borrador',
  FINALIZADO: 'Finalizado',
};

// Estado efectivo: ABIERTO + (sin fecha límite o futura) + cupo disponible.
export function registrationReason(
  event: RegistrationStateInput,
  registered: number,
  now: Date = new Date()
): RegistrationReason {
  if (event.status === 'BORRADOR') return 'BORRADOR';
  if (event.status === 'FINALIZADO') return 'FINALIZADO';
  if (event.status !== 'ABIERTO') return 'CERRADAS_MANUAL';
  if (event.registrationDeadline && now > event.registrationDeadline) return 'CERRADA_FECHA';
  if (event.capacity !== null && registered >= event.capacity) return 'CUPO_LLENO';
  return 'ABIERTAS';
}
