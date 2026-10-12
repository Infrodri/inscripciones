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
