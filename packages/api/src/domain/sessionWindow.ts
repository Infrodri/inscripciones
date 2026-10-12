// Ventana de check-in: desde startsAt - window hasta (endsAt ?? startsAt + 4h) + window.
// Todo en UTC (timestamptz); America/La_Paz solo se aplica en presentación.
export interface SessionWindow {
  start: Date;
  end: Date;
}

export function buildSessionWindow(
  startsAt: Date,
  endsAt: Date | null,
  checkinWindowMinutes: number
): SessionWindow {
  const windowMs = checkinWindowMinutes * 60_000;
  const effectiveEnd = endsAt ?? new Date(startsAt.getTime() + 4 * 3_600_000);
  return {
    start: new Date(startsAt.getTime() - windowMs),
    end: new Date(effectiveEnd.getTime() + windowMs),
  };
}

export function isSessionActive(
  now: Date,
  startsAt: Date,
  endsAt: Date | null,
  checkinWindowMinutes: number
): boolean {
  const window = buildSessionWindow(startsAt, endsAt, checkinWindowMinutes);
  return now >= window.start && now <= window.end;
}
