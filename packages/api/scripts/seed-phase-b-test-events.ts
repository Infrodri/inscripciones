import { PrismaClient, ParticipantType, SpeakerRole, RoleKind, StaffAccessLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cargando Fase B: 4 Eventos de Prueba [PRUEBA] ---');

  // 1. Limpieza de eventos previos de prueba de la Fase B
  const testSlugs = [
    'prueba-reunion-nacional-sectorial-derecho-2026',
    'prueba-transformacion-multilateralismo-onu-2026',
    'prueba-analisis-proyecto-ley-denuncias-falsas-2026',
    'prueba-estado-derecho-justicia-penal-bolivia-2026',
  ];

  for (const slug of testSlugs) {
    const existing = await prisma.event.findUnique({ where: { slug } });
    if (existing) {
      console.log(`Limpiando evento previo: ${slug}`);
      await prisma.attendance.deleteMany({ where: { session: { eventId: existing.id } } });
      await prisma.session.deleteMany({ where: { eventId: existing.id } });
      await prisma.speaker.deleteMany({ where: { eventId: existing.id } });
      await prisma.sponsor.deleteMany({ where: { eventId: existing.id } });
      await prisma.certificateRecipient.deleteMany({ where: { eventId: existing.id } });
      await prisma.certificateTemplate.deleteMany({ where: { eventId: existing.id } });
      await prisma.eventStaff.deleteMany({ where: { eventId: existing.id } });
      await prisma.participant.deleteMany({ where: { eventId: existing.id } });
      await prisma.event.delete({ where: { id: existing.id } });
    }
  }

  // 2. Usuarios base
  let admin = await prisma.user.findUnique({ where: { email: 'admin@usfx.bo' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@usfx.bo',
        name: 'Administrador General USFX',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        active: true,
      },
    });
  }

  let staffManager = await prisma.user.findUnique({ where: { email: 'staff.manager@usfx.bo' } });
  if (!staffManager) {
    staffManager = await prisma.user.create({
      data: {
        email: 'staff.manager@usfx.bo',
        name: 'Staff Manager Sectorial',
        passwordHash: await bcrypt.hash('staff123', 10),
        role: 'STAFF',
        active: true,
      },
    });
  }

  let staffOperator = await prisma.user.findUnique({ where: { email: 'staff.operador@usfx.bo' } });
  if (!staffOperator) {
    staffOperator = await prisma.user.create({
      data: {
        email: 'staff.operador@usfx.bo',
        name: 'Staff Operador Escáner',
        passwordHash: await bcrypt.hash('staff123', 10),
        role: 'STAFF',
        active: true,
      },
    });
  }

  // =========================================================================
  // EVENTO 1: SECTORIAL DE DERECHO (19 y 20 oct 2026)
  // =========================================================================
  console.log('\n1. Creando Evento Sectorial de Derecho 2026...');
  const sectorial = await prisma.event.create({
    data: {
      slug: 'prueba-reunion-nacional-sectorial-derecho-2026',
      title: '[PRUEBA] Reunión Nacional de Seguimiento a la Sectorial de Carreras de Derecho',
      eventKind: 'Reunión Nacional / Sectorial',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      organizer: 'Carrera de Derecho, Facultad de Derecho, Ciencias Políticas y Sociales',
      location: 'Facultad de Derecho, calle Colombia esq. Av. Germán Mendoza s/n, Sucre',
      modality: 'PRESENCIAL',
      status: 'ABIERTO',
      isFree: true,
      minAttendancePercent: 80,
      checkinWindowMinutes: 90,
      requireCareer: true,
      requireInstitution: true,
      createdBy: admin.id,
      staffAssignments: {
        create: [
          { userId: staffManager.id, accessLevel: StaffAccessLevel.MANAGER, assignedBy: admin.id },
          { userId: staffOperator.id, accessLevel: StaffAccessLevel.OPERATOR, assignedBy: admin.id },
        ],
      },
    },
  });

  // Sesiones de la Sectorial (6 sesiones)
  const sesInauguracion = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Acto de inauguración',
      location: 'Salón de Honor, Patio Histórico, Facultad de Derecho, calle Junín N.º 652',
      startsAt: new Date('2026-10-19T09:30:00-04:00'),
      endsAt: new Date('2026-10-19T11:00:00-04:00'),
      selfCheckinOpen: true,
    },
  });

  const sesMesa1 = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Mesa N.º 1: Seguimiento y evaluación del cumplimiento de resoluciones y acuerdos de la Sectorial 2023',
      location: 'Sala de Defensas, 2.º piso, Facultad de Derecho',
      startsAt: new Date('2026-10-19T11:00:00-04:00'),
      endsAt: new Date('2026-10-19T13:00:00-04:00'),
      selfCheckinOpen: true,
    },
  });

  const sesMesa2 = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Mesa N.º 2: Seguimiento y evaluación del cumplimiento de resoluciones y acuerdos de la Sectorial 2023',
      location: 'Aula A-201, Facultad de Derecho',
      startsAt: new Date('2026-10-19T11:00:00-04:00'),
      endsAt: new Date('2026-10-19T13:00:00-04:00'),
      selfCheckinOpen: true,
    },
  });

  const sesPlenaria = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Sesión plenaria',
      location: 'Salón de Honor «Ramiro Samos Oroza», calle Colombia esq. Av. Germán Mendoza',
      startsAt: new Date('2026-10-20T10:30:00-04:00'),
      endsAt: new Date('2026-10-20T16:00:00-04:00'),
      selfCheckinOpen: false,
    },
  });

  const sesConclusiones = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Lectura de conclusiones',
      location: 'Salón de Honor «Ramiro Samos Oroza»',
      startsAt: new Date('2026-10-20T16:00:00-04:00'),
      endsAt: new Date('2026-10-20T18:30:00-04:00'),
      selfCheckinOpen: false,
    },
  });

  const sesClausura = await prisma.session.create({
    data: {
      eventId: sectorial.id,
      label: 'Acto de clausura',
      location: 'Salón de Honor «Ramiro Samos Oroza»',
      startsAt: new Date('2026-10-20T18:30:00-04:00'),
      endsAt: new Date('2026-10-20T19:30:00-04:00'),
      selfCheckinOpen: false,
    },
  });

  // Expositores (6) — Nota: SpeakerRole en schema.prisma solo soporta EXPOSITOR | MODERADOR
  const speakersData = [
    { name: 'Dr. César Suárez Saavedra', role: SpeakerRole.MODERADOR, title: 'Abogado y docente universitario' },
    { name: 'Dr. Wilfredo Cervantes Ortiz', role: SpeakerRole.MODERADOR, title: 'Relator Mesa N.º 1' },
    { name: 'Dr. Ramiro Ibáñez Ferrufino', role: SpeakerRole.MODERADOR, title: 'Moderador Mesa N.º 2' },
    { name: 'Dr. Luis Fernando Gorena Belling', role: SpeakerRole.MODERADOR, title: 'Relator Mesa N.º 2 / Coordinación' },
    { name: 'Dr. Marco Antonio Barroso Mendizábal', role: SpeakerRole.MODERADOR, title: 'Moderador Sesión Plenaria / Coordinación' },
    { name: 'Dra. Ma. Tania Álvarez Gantier', role: SpeakerRole.MODERADOR, title: 'Relator Sesión Plenaria' },
  ];

  for (const s of speakersData) {
    await prisma.speaker.create({
      data: {
        eventId: sectorial.id,
        fullName: s.name,
        role: s.role,
        titleProfession: s.title,
      },
    });
  }

  // 18 Organizadores
  const organizadores = [
    { name: 'Dr. Mario Linares Linares', comision: 'Comité de Coordinación' },
    { name: 'Dr. Vladimir Gutiérrez Pérez', comision: 'Comité de Coordinación' },
    { name: 'Dr. Marco Antonio Barroso Mendizábal', comision: 'Comité de Coordinación' },
    { name: 'Dr. Luis Fernando Gorena Belling', comision: 'Comité de Coordinación' },
    { name: 'Abog. María del Carmen Tirado Rúa', comision: 'Comité de Coordinación' },
    { name: 'Lobsang Valda Doria Medina', comision: 'Comité de Coordinación' },
    { name: 'Dra. Mary Sol Landívar', comision: 'Registro y Credenciales' },
    { name: 'Ibar Max Ruiz Armijo', comision: 'Registro y Credenciales' },
    { name: 'Dr. Freddy Edison Padilla Molina', comision: 'Sistemas y Tecnología' },
    { name: 'Ing. Richard Cruz', comision: 'Sistemas y Tecnología' },
    { name: 'René Orlando Céspedes Subieta', comision: 'Sistemas y Tecnología' },
    { name: 'Dr. Rodolfo Mérida Rendón', comision: 'Protocolo y Comunicación' },
    { name: 'Dr. Marco Antonio Barroso Mendizábal', comision: 'Protocolo y Comunicación' },
    { name: 'Dra. Carla Ivana Bellido Terán', comision: 'Refrigerios y Atención' },
    { name: 'Lic. Irene Gorostiaga Bustillos', comision: 'Refrigerios y Atención' },
    { name: 'Lic. Teddy Paniagua', comision: 'Refrigerios y Atención' },
    { name: 'Lobsang Valda Doria Medina', comision: 'Materiales y Publicidad' },
    { name: 'David Vaca Guzmán Bobarin', comision: 'Materiales y Publicidad' },
  ];

  // Plantillas de certificado por defecto para el evento
  const templateAsistente = await prisma.certificateTemplate.create({
    data: {
      eventId: sectorial.id,
      name: 'Plantilla Delegados / Asistentes',
      roleKind: RoleKind.ASISTENTE,
      filePath: 'templates/default-delegados.png',
      widthPx: 1920,
      heightPx: 1080,
      pageWidthMm: 297,
      pageHeightMm: 210,
      nameBox: { x: 200, y: 450, width: 1520, height: 120, fontSize: 36, alignment: 'center' },
      isDefault: true,
    },
  });

  const templateExpositor = await prisma.certificateTemplate.create({
    data: {
      eventId: sectorial.id,
      name: 'Plantilla Expositores y Relatores',
      roleKind: RoleKind.EXPOSITOR,
      filePath: 'templates/default-expositores.png',
      widthPx: 1920,
      heightPx: 1080,
      pageWidthMm: 297,
      pageHeightMm: 210,
      nameBox: { x: 200, y: 450, width: 1520, height: 120, fontSize: 36, alignment: 'center' },
      isDefault: true,
    },
  });

  const templateOrganizador = await prisma.certificateTemplate.create({
    data: {
      eventId: sectorial.id,
      name: 'Plantilla Comité Organizador',
      roleKind: RoleKind.ORGANIZADOR,
      filePath: 'templates/default-organizadores.png',
      widthPx: 1920,
      heightPx: 1080,
      pageWidthMm: 297,
      pageHeightMm: 210,
      nameBox: { x: 200, y: 450, width: 1520, height: 120, fontSize: 36, alignment: 'center' },
      isDefault: true,
    },
  });

  for (const org of organizadores) {
    await prisma.certificateRecipient.create({
      data: {
        eventId: sectorial.id,
        templateId: templateOrganizador.id,
        fullName: org.name,
        roleKind: RoleKind.ORGANIZADOR,
        note: `Organizador · ${org.comision}`,
        certificateCode: `SECT-ORG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      },
    });
  }

  // Delegados de prueba (9 ficticios según tabla)
  const delegados = [
    { nombre: 'Ana', apellido: 'Quispe', ci: '10000001', univ: 'UMSA', email: 'ana.prueba@example.com' },
    { nombre: 'Bruno', apellido: 'Mamani', ci: '10000002', univ: 'UMSS', email: 'bruno.prueba@example.com' },
    { nombre: 'Carla', apellido: 'Flores', ci: '10000003', univ: 'UAGRM', email: 'carla.prueba@example.com' },
    { nombre: 'Diego', apellido: 'Rojas', ci: '10000004', univ: 'UTO', email: 'diego.prueba@example.com' },
    { nombre: 'Elena', apellido: 'Vargas', ci: '10000005', univ: 'UAJMS', email: 'elena.prueba@example.com' },
    { nombre: 'Fabio', apellido: 'Choque', ci: '10000006', univ: 'UAP', email: 'fabio.prueba@example.com' },
    { nombre: 'Gabriela', apellido: 'Cruz', ci: '00123456', univ: 'UMSA', email: 'gabriela.prueba@example.com' },
    { nombre: 'Héctor', apellido: 'Peña', ci: '10000008', univ: 'UPSA', email: null },
    { nombre: 'Íñigo', apellido: 'Núñez', ci: '10000009', univ: 'UMSS', email: 'inigo.prueba@example.com' },
  ];

  const partMap = new Map<string, string>();
  for (const d of delegados) {
    const part = await prisma.participant.create({
      data: {
        eventId: sectorial.id,
        firstName: d.nombre,
        lastName: d.apellido,
        ci: d.ci,
        email: d.email,
        type: ParticipantType.ESTUDIANTE,
        institution: d.univ,
        career: 'Derecho',
        qrToken: `qr-${d.ci}`,
        certificateCode: `SECT-DEL-${d.ci}`,
        dataConsentAt: new Date(),
      },
    });
    partMap.set(d.ci, part.id);
  }

  // Simulación de asistencias para cálculo de aptitud
  // Ana Quispe: Inauguración, Mesa 1, Plenaria, Conclusiones, Clausura (5 sesiones de 6)
  const anaId = partMap.get('10000001')!;
  for (const ses of [sesInauguracion, sesMesa1, sesPlenaria, sesConclusiones, sesClausura]) {
    await prisma.attendance.create({ data: { participantId: anaId, sessionId: ses.id, method: 'QR' } });
  }

  // Bruno Mamani: Inauguración, Mesa 1, Conclusiones, Clausura (faltó a plenaria) -> 4 de 6
  const brunoId = partMap.get('10000002')!;
  for (const ses of [sesInauguracion, sesMesa1, sesConclusiones, sesClausura]) {
    await prisma.attendance.create({ data: { participantId: brunoId, sessionId: ses.id, method: 'QR' } });
  }

  // Carla Flores: Inauguración, Mesa 2, Plenaria, Conclusiones, Clausura -> 5 de 6
  const carlaId = partMap.get('10000003')!;
  for (const ses of [sesInauguracion, sesMesa2, sesPlenaria, sesConclusiones, sesClausura]) {
    await prisma.attendance.create({ data: { participantId: carlaId, sessionId: ses.id, method: 'QR' } });
  }

  // Diego Rojas: Inauguración, Mesa 1 (error de mesa), Plenaria, Conclusiones, Clausura -> 5 de 6
  const diegoId = partMap.get('10000004')!;
  for (const ses of [sesInauguracion, sesMesa1, sesPlenaria, sesConclusiones, sesClausura]) {
    await prisma.attendance.create({ data: { participantId: diegoId, sessionId: ses.id, method: 'QR' } });
  }

  // Elena Vargas: Inauguración, Plenaria, Conclusiones, Clausura (4 sesiones comunes) -> 4 de 6
  const elenaId = partMap.get('10000005')!;
  for (const ses of [sesInauguracion, sesPlenaria, sesConclusiones, sesClausura]) {
    await prisma.attendance.create({ data: { participantId: elenaId, sessionId: ses.id, method: 'QR' } });
  }

  // Fabio Choque: 0 asistencias
  // Gabriela Cruz: C.I. 00123456 conserva ceros

  console.log(`Evento Sectorial creado: ${sectorial.id} con 6 sesiones, 6 expositores, 18 organizadores, 9 delegados.`);

  // =========================================================================
  // EVENTO E1 (16 oct 2026 - Retroactivo)
  // =========================================================================
  console.log('\n2. Creando Evento E1 (Multilateralismo ONU)...');
  const e1 = await prisma.event.create({
    data: {
      slug: 'prueba-transformacion-multilateralismo-onu-2026',
      title: '[PRUEBA] Transformación o fin del multilateralismo en la ONU',
      eventKind: 'Conferencia',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      commemoration: 'En conmemoración del CCCXLV aniversario de la fundación de la Facultad de Derecho',
      organizer: 'Facultad de Derecho, Ciencias Políticas y Sociales',
      location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
      modality: 'PRESENCIAL',
      status: 'FINALIZADO',
      isFree: true,
      minAttendancePercent: 80,
      contactWhatsapp: '70314297',
      createdBy: admin.id,
      sessions: {
        create: [
          {
            label: 'Conferencia Magistral',
            startsAt: new Date('2026-10-16T11:00:00-04:00'),
            endsAt: new Date('2026-10-16T12:30:00-04:00'),
            location: 'Salón de Honor, Facultad de Derecho',
          },
        ],
      },
      speakers: {
        create: [
          {
            fullName: 'Marco Antonio Barroso Mendizábal',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado, Diplomático de Carrera del Ministerio de Relaciones Exteriores y docente universitario',
          },
        ],
      },
    },
  });
  console.log(`Evento E1 creado: ${e1.id}`);

  // =========================================================================
  // EVENTO E2 (12 oct 2026 - Retroactivo)
  // =========================================================================
  console.log('\n3. Creando Evento E2 (Ley denuncias falsas)...');
  const e2 = await prisma.event.create({
    data: {
      slug: 'prueba-analisis-proyecto-ley-denuncias-falsas-2026',
      title: '[PRUEBA] Análisis del proyecto de ley de protección jurídica contra las denuncias o acusaciones falsas y la instrumentalización de la justicia',
      eventKind: 'Conversatorio',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      commemoration: 'En conmemoración del CCCXLV aniversario de la fundación de la Facultad de Derecho',
      organizer: 'Facultad de Derecho, Ciencias Políticas y Sociales · Carrera de Derecho · Promociones 2026 · Cursos 5-3, 5-4 y 5-5',
      audienceNote: 'Dirigido a Promociones 2026 · Cursos 5-3, 5-4 y 5-5',
      location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
      modality: 'PRESENCIAL',
      status: 'FINALIZADO',
      isFree: true,
      minAttendancePercent: 80,
      contactWhatsapp: '67635450',
      createdBy: admin.id,
      sessions: {
        create: [
          {
            label: 'Conversatorio Jurídico',
            startsAt: new Date('2026-10-12T18:00:00-04:00'),
            endsAt: new Date('2026-10-12T20:00:00-04:00'),
            location: 'Salón de Honor, Facultad de Derecho',
          },
        ],
      },
      speakers: {
        create: [
          {
            fullName: 'Dr. César Suárez Saavedra',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado y docente',
          },
          {
            fullName: 'Dr. Wilder Manuel Castillo Subirana',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado y docente',
          },
          {
            fullName: 'Dr. Marco Antonio Barroso Mendizábal',
            role: SpeakerRole.MODERADOR,
            titleProfession: 'Abogado, diplomático del Ministerio de Relaciones Exteriores y docente',
          },
        ],
      },
    },
  });
  console.log(`Evento E2 creado: ${e2.id}`);

  // =========================================================================
  // EVENTO E3 (13 oct 2026 - Retroactivo, de pago)
  // =========================================================================
  console.log('\n4. Creando Evento E3 (Justicia Penal - De Pago Bs 20)...');
  const e3 = await prisma.event.create({
    data: {
      slug: 'prueba-estado-derecho-justicia-penal-bolivia-2026',
      title: '[PRUEBA] El Estado de Derecho y Justicia Penal en Bolivia',
      eventKind: 'Seminario',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      commemoration: 'CCCXLV años de fundación de la Facultad de Derecho',
      organizer: 'Sociedad Científica de Estudiantes de Derecho (SCED) · Carrera de Derecho · Facultad de Derecho, Cs. Políticas y Sociales',
      location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
      modality: 'PRESENCIAL',
      status: 'FINALIZADO',
      isFree: false,
      cost: 20,
      minAttendancePercent: 80,
      contactWhatsapp: 'Pago en efectivo, al lado de Dirección de Carrera de Derecho',
      createdBy: admin.id,
      sessions: {
        create: [
          {
            label: 'Jornada Académica Penal',
            startsAt: new Date('2026-10-13T18:00:00-04:00'),
            endsAt: new Date('2026-10-13T20:00:00-04:00'),
            location: 'Salón de Honor, Facultad de Derecho',
          },
        ],
      },
      speakers: {
        create: [
          {
            fullName: 'Dr. Mario Gonzáles Durán',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado, docente universitario y jurista',
          },
          {
            fullName: 'Dr. Carlos Eduardo Ortega Sivila',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado, Magistrado del Tribunal Supremo de Justicia y docente universitario',
          },
          {
            fullName: 'Dr. Jaime René Conde Andrade',
            role: SpeakerRole.EXPOSITOR,
            titleProfession: 'Abogado y docente universitario',
          },
          {
            fullName: 'Periodista Delfin Ustarez',
            role: SpeakerRole.MODERADOR,
            titleProfession: 'Periodista',
          },
        ],
      },
    },
  });
  console.log(`Evento E3 creado: ${e3.id}`);

  console.log('\n--- Carga de Fase B completada exitosamente. ---');
}

main()
  .catch((err) => {
    console.error('Error cargando eventos de prueba:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
