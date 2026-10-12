// Réplica exacta de la ventana del API (domain/sessionWindow): desde
// startsAt - window hasta (endsAt ?? startsAt + 4h) + window. Todo en UTC;
// America/La_Paz solo en presentación.
export function isSessionActiveNow(
  nowMs: number,
  startsAtIso: string,
  endsAtIso: string | null,
  checkinWindowMinutes: number
): boolean {
  const startsAt = new Date(startsAtIso).getTime();
  const windowMs = checkinWindowMinutes * 60_000;
  const effectiveEnd = endsAtIso ? new Date(endsAtIso).getTime() : startsAt + 4 * 3_600_000;
  return nowMs >= startsAt - windowMs && nowMs <= effectiveEnd + windowMs;
}

export function formatLaPaz(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

export function scanPath(sessionId: string): string {
  return `/scan/${sessionId}`;
}
