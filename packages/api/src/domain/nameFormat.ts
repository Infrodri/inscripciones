// Firma mínima de formato de nombre (implementación completa en FASE E1).
// TITLE respeta partículas en minúscula y conserva tildes/ñ; UPPER mantiene acentos.
export type NameCaseOption = 'UPPER' | 'TITLE' | 'AS_TYPED';

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

export function formatPrintedName(fullName: string, mode: NameCaseOption): string {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (mode === 'AS_TYPED') return clean;
  if (mode === 'UPPER') return clean.toLocaleUpperCase('es-BO');
  return clean
    .split(' ')
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('es-BO');
      if (index > 0 && PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('es-BO') + lower.slice(1);
    })
    .join(' ');
}
