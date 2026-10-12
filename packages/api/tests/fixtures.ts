// TEST ONLY: datos de prueba para seed y tests. No usar en producción.
export const TEST_MARK = 'TEST_FIXTURE';

export const referenceEventSeed = {
  slug: 'conversatorio-ley-denuncias-falsas-2026',
  title:
    'Análisis del Proyecto de Ley de Protección Jurídica contra las Denuncias o Acusaciones Falsas y la Instrumentalización de la Justicia',
  eventKind: 'Conversatorio',
  institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
  // Discrepancia: el afiche dice CCCLXV pero los certificados dicen CCCXLV; 2026-1681=345, se usa CCCXLV.
  commemoration:
    'En conmemoración del CCCXLV aniversario de la fundación de la Facultad de Derecho',
  organizer:
    'Facultad de Derecho, Ciencias Políticas y Sociales • Carrera de Derecho • Promociones 2026 • Cursos: 5-3; 5-4 y 5-5',
  location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
  modality: 'PRESENCIAL',
  status: 'BORRADOR',
  isFree: true,
  contactWhatsapp: '67635450',
  issuesCertificate: true,
  // Zona America/La_Paz (UTC-4). En BD se guarda timestamptz (UTC).
  sessionStartsAt: '2026-10-12T18:00:00-04:00',
  speakers: [
    {
      fullName: 'Dr. César Suárez Saavedra',
      titleProfession: 'Abogado y docente',
      role: 'EXPOSITOR',
    },
    {
      fullName: 'Dr. Wilder Manuel Castillo Subirana',
      titleProfession: 'Abogado y docente',
      role: 'EXPOSITOR',
    },
    {
      fullName: 'Dr. Marco Antonio Barroso Mendizábal',
      titleProfession: 'Abogado, diplomático del Ministerio de Relaciones Exteriores y docente',
      role: 'MODERADOR',
    },
  ],
};

export const secondEventSeed = {
  slug: 'conversatorio-ley-denuncias-falsas-2026-dia-2',
  title: `${referenceEventSeed.title} — Día 2 (TEST)`,
  sessionStarts: [
    '2026-10-13T09:00:00-04:00',
    '2026-10-13T15:00:00-04:00',
    '2026-10-13T18:00:00-04:00',
  ],
};

// TEST ONLY: pertenecen al segundo evento (3 sesiones).
export const testParticipants = [
  {
    firstName: 'Ana',
    lastName: 'Pérez',
    ci: 'TEST111',
    email: 'ana.perez@test.com',
    sessionsAttended: 3,
  },
  {
    firstName: 'Juan',
    lastName: 'Peña Muñoz',
    ci: 'TEST222',
    email: 'juan.pena@test.com',
    sessionsAttended: 2,
  },
  {
    firstName: 'María Eugenia',
    lastName: 'Santiváñez Rocha de la Fuente del Valle Muy Larga Para Probar Reducción',
    ci: 'TEST333',
    email: 'maria.santivanez@test.com',
    sessionsAttended: 1,
  },
  {
    firstName: 'Pedro',
    lastName: 'Soto',
    ci: 'TEST444',
    email: 'pedro.soto@test.com',
    sessionsAttended: 0,
  },
];

export const testTemplates = [
  { key: 'asistente', roleKind: 'ASISTENTE' },
  { key: 'expositor', roleKind: 'EXPOSITOR' },
  { key: 'expositor-moderador', roleKind: 'EXPOSITOR' },
  { key: 'organizador-decana', roleKind: 'ORGANIZADOR' },
  { key: 'organizador-director', roleKind: 'ORGANIZADOR' },
];

export const testRecipients = [
  { fullName: 'Dr. César Suárez Saavedra', roleKind: 'EXPOSITOR', templateKey: 'expositor' },
  {
    fullName: 'Dr. Wilder Manuel Castillo Subirana',
    roleKind: 'EXPOSITOR',
    templateKey: 'expositor',
  },
  {
    fullName: 'Dr. Marco Antonio Barroso Mendizábal',
    roleKind: 'EXPOSITOR',
    templateKey: 'expositor-moderador',
  },
  {
    fullName: 'Mgtr. Ingrid Amanda Iris Pereira Poppe',
    roleKind: 'ORGANIZADOR',
    templateKey: 'organizador-decana',
  },
  {
    fullName: 'Dr. Mario Abdón Linares Linares',
    roleKind: 'ORGANIZADOR',
    templateKey: 'organizador-director',
  },
];
