import { isSessionActive } from '../domain/sessionWindow.js';
import { DomainError } from '../domain/errors.js';

export interface CheckinSession {
  startsAt: Date;
  endsAt: Date | null;
  checkinWindowMinutes: number;
}

// Porcentaje = asistencias no anuladas / total de sesiones × 100.
// 1 sesión con 1 asistencia = 100% = apto.
export function attendancePercentage(attendedSessions: number, totalSessions: number): number {
  if (totalSessions === 0) return 0;
  return (attendedSessions / totalSessions) * 100;
}

export function assertSessionWindow(now: Date, session: CheckinSession): void {
  if (!isSessionActive(now, session.startsAt, session.endsAt, session.checkinWindowMinutes)) {
    throw new DomainError('SESSION_NOT_ACTIVE', 'La sesión no está en horario de registro');
  }
}

export function isEligible(
  attendedSessions: number,
  totalSessions: number,
  minPercent: number
): boolean {
  return attendancePercentage(attendedSessions, totalSessions) >= minPercent;
}
