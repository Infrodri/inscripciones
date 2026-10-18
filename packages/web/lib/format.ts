// Formato único de fechas: "lun 12 oct 2026 · 15:45" (America/La_Paz, es-BO, 24 h).
export function formatFechaHora(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const clean = (value: string): string => value.replace(/\./g, '').toLowerCase();
  const time = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${clean(get('weekday'))} ${get('day')} ${clean(get('month'))} ${get('year')} · ${time}`;
}

export function formatFecha(iso: string | Date): string {
  return formatFechaHora(iso).split(' · ')[0];
}

/**
 * Retorna la fecha en formato YYYY-MM-DD según la zona horaria America/La_Paz.
 */
export function getLaPazDateString(iso: string | Date = new Date()): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Clasifica una sesión en 'hoy', 'proximas' o 'pasadas' según la zona horaria America/La_Paz.
 */
export function getSessionCategory(
  startsAtIso: string,
  now: Date | string = new Date()
): 'hoy' | 'proximas' | 'pasadas' {
  const todayStr = getLaPazDateString(now);
  const sessionStr = getLaPazDateString(startsAtIso);

  if (sessionStr === todayStr) {
    return 'hoy';
  }
  if (sessionStr > todayStr) {
    return 'proximas';
  }
  return 'pasadas';
}

/**
 * Formatea un rango de fecha y hora para una sesión en es-BO 24 h.
 */
export function formatRangoSesion(
  startsAtIso: string | Date,
  endsAtIso?: string | Date | null
): string {
  const startStr = formatFechaHora(startsAtIso);
  if (!endsAtIso) return startStr;
  const endDate = typeof endsAtIso === 'string' ? new Date(endsAtIso) : endsAtIso;
  const endTime = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(endDate);
  return `${startStr} – ${endTime}`;
}

/**
 * Formatea el costo de un evento.
 * Evita 'null Bs'. Si es de pago pero cost es null/undefined/0 retorna 'Consultar costo'.
 */
export function formatCosto(isFree: boolean, cost?: number | null): string {
  if (isFree) return 'Gratuito';
  if (cost === null || cost === undefined || Number.isNaN(Number(cost)) || Number(cost) <= 0) {
    return 'Consultar costo';
  }
  return `${Number(cost)} Bs`;
}

/**
 * Normaliza texto eliminando tildes y diacríticos para búsquedas insensibles.
 * Ej: "tecnología" -> "tecnologia"
 */
export function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Mapea enums de modalidad a etiquetas con capitalización adecuada en español.
 */
export function formatModality(modality?: string | null): string {
  switch (modality) {
    case 'PRESENCIAL':
      return 'Presencial';
    case 'VIRTUAL':
      return 'Virtual';
    case 'HIBRIDO':
      return 'Híbrido';
    default:
      return modality
        ? modality.charAt(0).toUpperCase() + modality.slice(1).toLowerCase()
        : 'Presencial';
  }
}

/**
 * Obtiene la sesión más próxima en el tiempo (mínimo startsAt) en vez de asumir sessions[0].
 */
export function getProximaSesion<T extends { startsAt: string | Date }>(
  sessions?: T[] | null
): T | null {
  if (!sessions || sessions.length === 0) return null;
  const now = Date.now();
  // Primero buscar la sesión futura más próxima
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
  const future = sorted.find((s) => new Date(s.startsAt).getTime() >= now);
  return future ?? sorted[0];
}
