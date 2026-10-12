import { describe, expect, it } from 'vitest';
import { normalizeCi, normalizeEmail, normalizeParticipant } from '../src/shared/normalize.js';
import { buildSessionWindow, isSessionActive } from '../src/domain/sessionWindow.js';
import { formatPrintedName } from '../src/domain/nameFormat.js';
import {
  buildDuplicateSlug,
  buildSlug,
  validateEventInput,
} from '../src/application/eventService.js';
import { DomainError } from '../src/domain/errors.js';

describe('normalize', () => {
  it('email en minúsculas y sin espacios', () => {
    expect(normalizeEmail('  ANA@TEST.COM ')).toBe('ana@test.com');
  });
  it('CI sin espacios', () => {
    expect(normalizeCi(' 12 34 56 ')).toBe('123456');
  });
  it('participante normalizado', () => {
    expect(
      normalizeParticipant({
        firstName: '  Ana ',
        lastName: 'Pérez ',
        ci: ' 1 2 3 ',
        email: 'A@T.COM',
      })
    ).toEqual({ firstName: 'Ana', lastName: 'Pérez', ci: '123', email: 'a@t.com' });
  });
});

describe('sessionWindow', () => {
  const starts = new Date('2026-10-12T18:00:00-04:00');
  it('ventana con ends_at null usa startsAt + 4h', () => {
    const window = buildSessionWindow(starts, null, 60);
    expect(window.start).toEqual(new Date('2026-10-12T17:00:00-04:00'));
    expect(window.end).toEqual(new Date('2026-10-12T23:00:00-04:00'));
  });
  it('activo dentro de la ventana, inactivo fuera', () => {
    expect(isSessionActive(new Date('2026-10-12T18:30:00-04:00'), starts, null, 60)).toBe(true);
    expect(isSessionActive(new Date('2026-10-13T00:00:00-04:00'), starts, null, 60)).toBe(false);
  });
});

describe('nameFormat', () => {
  it('TITLE respeta partículas y conserva ñ/tildes', () => {
    expect(formatPrintedName('maría peña de la fuente', 'TITLE')).toBe('María Peña de la Fuente');
  });
  it('UPPER mantiene acentos', () => {
    expect(formatPrintedName('Peña Muñoz', 'UPPER')).toBe('PEÑA MUÑOZ');
  });
  it('AS_TYPED no toca el texto', () => {
    expect(formatPrintedName('Dr. César Suárez Saavedra', 'AS_TYPED')).toBe(
      'Dr. César Suárez Saavedra'
    );
  });
});

describe('eventService', () => {
  it('slug sin tildes ni mayúsculas', () => {
    expect(buildSlug('Análisis Jurídico 2026')).toBe('analisis-juridico-2026');
  });
  it('duplicate agrega sufijo copia', () => {
    expect(buildDuplicateSlug('mi-evento')).toBe('mi-evento-copia');
  });
  it('rechaza título vacío', () => {
    expect(() =>
      validateEventInput({
        slug: 'x',
        title: ' ',
        eventKind: 'k',
        institution: 'i',
        organizer: 'o',
        location: 'l',
      })
    ).toThrowError(DomainError);
  });
});
