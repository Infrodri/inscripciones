import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Extract target DB URL from CLI args, env, or .env.production fallback
function resolveDbUrl() {
  const arg = process.argv.find((a) => a.startsWith('--url='));
  if (arg) return arg.split('=')[1];
  if (process.env.TARGET_DATABASE_URL) return process.env.TARGET_DATABASE_URL;

  // Try reading from .env.production in root
  try {
    const prodEnvPath = path.resolve(process.cwd(), '../../.env.production');
    if (fs.existsSync(prodEnvPath)) {
      const content = fs.readFileSync(prodEnvPath, 'utf8');
      const matchDirect = content.match(/^PROD_DIRECT_URL=(.+)$/m);
      if (matchDirect && matchDirect[1].trim() && !matchDirect[1].includes('[TU-PASSWORD]')) {
        return matchDirect[1].trim();
      }
      const matchPooler = content.match(/^PROD_DATABASE_URL=(.+)$/m);
      if (matchPooler && matchPooler[1].trim() && !matchPooler[1].includes('[TU-PASSWORD]')) {
        return matchPooler[1].trim();
      }
    }
  } catch (err) {
    void err;
  }

  return (
    process.env.DATABASE_URL ||
    'postgresql://inscripciones:inscripciones@localhost:5434/inscripciones'
  );
}

const targetUrl = resolveDbUrl();
console.log('Connecting to database:', targetUrl.replace(/:[^:@]+@/, ':****@'));

const prisma = new PrismaClient({
  datasources: { db: { url: targetUrl } },
});

async function main() {
  // 1. Ensure Admin User exists
  const adminEmail = 'jose.rios.usfx1@gmail.com';
  const passwordHash = await bcrypt.hash('123456789', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'ADMIN',
      active: true,
      name: 'Ing. José Ríos',
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      active: true,
      name: 'Ing. José Ríos',
    },
  });
  console.log('✓ Admin user verified:', admin.email);

  // 2. Flagship Event: Congreso Internacional de Derecho 2026
  const congressSlug = 'congreso-derecho-2026';
  const congress = await prisma.event.upsert({
    where: { slug: congressSlug },
    update: {
      status: 'ABIERTO',
      capacity: 350,
      registrationDeadline: new Date('2026-11-30T23:59:59Z'),
      location: 'Paraninfo Universitario - Calle Junín esq. Estudiantes',
      modality: 'PRESENCIAL',
      isFree: true,
      issuesCertificate: true,
      requireCareer: false,
      requireSemester: false,
      requireInstitution: true,
      requirePhone: true,
      contactWhatsapp: '67635450',
    },
    create: {
      slug: congressSlug,
      title: 'Congreso Internacional de Derecho Procesal y Constitucional 2026',
      eventKind: 'Congreso Internacional',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      commemoration: 'Homenaje al Bicentenario de Bolivia y CCCXLV Aniversario Facultativo',
      organizer: 'Facultad de Derecho, Ciencias Políticas y Sociales',
      audienceNote:
        'Abierto a estudiantes de pregrado, docentes, abogados del foro e investigadores.',
      description:
        'Magno encuentro de juristas y académicos de Bolivia, Argentina y España. Se abordarán reformas al código procesal, garantismo judicial, oralidad y عصر digital.',
      location: 'Paraninfo Universitario - Calle Junín esq. Estudiantes',
      modality: 'PRESENCIAL',
      capacity: 350,
      registrationDeadline: new Date('2026-11-30T23:59:59Z'),
      status: 'ABIERTO',
      isFree: true,
      contactWhatsapp: '67635450',
      issuesCertificate: true,
      minAttendancePercent: 80,
      checkinWindowMinutes: 90,
      requireCareer: false,
      requireSemester: false,
      requireInstitution: true,
      requirePhone: true,
      createdBy: admin.id,
    },
  });
  console.log('✓ Event verified:', congress.title, `(${congress.slug})`);

  // 3. Multi-track / Room Sessions for Congress
  await prisma.session.deleteMany({ where: { eventId: congress.id } });

  const s1 = await prisma.session.create({
    data: {
      eventId: congress.id,
      label: 'Sesión Inaugural y Ponencias Magistrales',
      location: 'Salón de Honor - Paraninfo Central',
      startsAt: new Date('2026-11-25T08:30:00Z'),
      endsAt: new Date('2026-11-25T12:30:00Z'),
      selfCheckinOpen: true,
    },
  });

  const s2 = await prisma.session.create({
    data: {
      eventId: congress.id,
      label: 'Mesa 1: Reformas Procesales, Oralidad y Nuevas Tecnologías',
      location: 'Sala de Audiencias A - Facultad de Derecho',
      startsAt: new Date('2026-11-25T14:30:00Z'),
      endsAt: new Date('2026-11-25T18:30:00Z'),
      selfCheckinOpen: true,
    },
  });

  const s3 = await prisma.session.create({
    data: {
      eventId: congress.id,
      label: 'Mesa 2: Garantías Constitucionales y Derechos Fundamentales',
      location: 'Auditorio Manuel Durán Padilla',
      startsAt: new Date('2026-11-26T08:30:00Z'),
      endsAt: new Date('2026-11-26T12:30:00Z'),
      selfCheckinOpen: true,
    },
  });

  const s4 = await prisma.session.create({
    data: {
      eventId: congress.id,
      label: 'Sesión Plenaria de Conclusiones y Clausura Académica',
      location: 'Salón de Honor - Paraninfo Central',
      startsAt: new Date('2026-11-26T14:30:00Z'),
      endsAt: new Date('2026-11-26T18:00:00Z'),
      selfCheckinOpen: false,
    },
  });
  console.log('✓ 4 Sessions/Tracks created with locations and labels');

  // 4. Speakers & Panelists
  await prisma.speaker.deleteMany({ where: { eventId: congress.id } });

  const speakersData = [
    {
      fullName: 'Dr. Carlos Mendoza Ortiz',
      titleProfession: 'Doctor en Derecho Constitucional, Docente Emérito USFX',
      role: 'EXPOSITOR',
      institution: 'Universidad San Francisco Xavier',
      position: 0,
    },
    {
      fullName: 'Dra. Elena Valenzuela Rivera',
      titleProfession: 'Especialista en Derecho Procesal Comparado',
      role: 'EXPOSITOR',
      institution: 'Universidad de Buenos Aires (Argentina)',
      position: 1,
    },
    {
      fullName: 'Dr. Miguel Ángel Santos Vidal',
      titleProfession: 'Catedrático de Derecho Probatorio y Razonamiento Jurídico',
      role: 'EXPOSITOR',
      institution: 'Universidad de Salamanca (España)',
      position: 2,
    },
    {
      fullName: 'Dra. Gabriela Paz Soldán Morales',
      titleProfession: 'Magistrada y Docente de Posgrado',
      role: 'MODERADOR',
      institution: 'Tribunal Departamental de Justicia',
      position: 3,
    },
  ];

  for (const sp of speakersData) {
    await prisma.speaker.create({
      data: {
        eventId: congress.id,
        fullName: sp.fullName,
        titleProfession: sp.titleProfession,
        role: sp.role,
        institution: sp.institution,
        position: sp.position,
      },
    });
  }
  console.log('✓ 4 Speakers and moderators registered');

  // 5. Sponsors & Partners
  await prisma.sponsor.deleteMany({ where: { eventId: congress.id } });

  const sponsorsData = [
    { name: 'Ilustre Colegio de Abogados de Chuquisaca (ICACH)', position: 0 },
    { name: 'Tribunal Departamental de Justicia de Chuquisaca', position: 1 },
    { name: 'Federación Universitaria Local (FUL - USFX)', position: 2 },
  ];

  for (const sp of sponsorsData) {
    await prisma.sponsor.create({
      data: {
        eventId: congress.id,
        name: sp.name,
        position: sp.position,
      },
    });
  }
  console.log('✓ 3 Institutional sponsors registered');

  // 6. Registered Attendees (Sample data for badges, attendance, and reporting)
  const attendees = [
    {
      firstName: 'Juan Carlos',
      lastName: 'Mamani Flores',
      ci: '8374921',
      email: 'juan.mamani@usfx.bo',
      phone: '71234501',
      type: 'ESTUDIANTE',
      institution: 'USFX - Carrera de Derecho',
      career: 'Derecho',
      semester: '8vo Semestre',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100% attendance
    },
    {
      firstName: 'Valeria Sofía',
      lastName: 'Romero Gutiérrez',
      ci: '5938201',
      email: 'valeria.romero@usfx.bo',
      phone: '71234502',
      type: 'ESTUDIANTE',
      institution: 'USFX - Carrera de Derecho',
      career: 'Derecho',
      semester: '6to Semestre',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100%
    },
    {
      firstName: 'Alejandro Javier',
      lastName: 'Morales Daza',
      ci: '7482910',
      email: 'alejandro.morales@usfx.bo',
      phone: '71234503',
      type: 'PROFESIONAL',
      institution: 'Colegio de Abogados de Chuquisaca',
      career: 'Abogado Corporativo',
      sessionsAttended: [s1.id, s2.id, s3.id], // 75%
    },
    {
      firstName: 'Dra. Carmen Rosa',
      lastName: 'Montellano Peñaranda',
      ci: '3928104',
      email: 'carmen.montellano@usfx.bo',
      phone: '71234504',
      type: 'DOCENTE',
      institution: 'Facultad de Derecho - USFX',
      career: 'Docente de Derecho Civil',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100%
    },
    {
      firstName: 'Mauricio Andrés',
      lastName: 'Vargas Mercado',
      ci: '8192038',
      email: 'mauricio.vargas@usfx.bo',
      phone: '71234505',
      type: 'PROFESIONAL',
      institution: 'Ministerio Público de Chuquisaca',
      career: 'Fiscal de Materia',
      sessionsAttended: [s1.id, s3.id, s4.id], // 75%
    },
    {
      firstName: 'Daniela Andrea',
      lastName: 'Campero Salinas',
      ci: '9382014',
      email: 'daniela.campero@usfx.bo',
      phone: '71234506',
      type: 'ESTUDIANTE',
      institution: 'USFX - Ciencias Políticas',
      career: 'Ciencias Políticas',
      semester: '4to Semestre',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100%
    },
    {
      firstName: 'Rodrigo Gonzalo',
      lastName: 'Peñaranda Ortiz',
      ci: '6928104',
      email: 'rodrigo.penaranda@gmail.com',
      phone: '71234507',
      type: 'PUBLICO',
      institution: 'Sociedad Civil de Sucre',
      career: 'Investigador Independiente',
      sessionsAttended: [s1.id, s2.id], // 50%
    },
    {
      firstName: 'Lic. Fernando',
      lastName: 'Alvarado Quispe',
      ci: '4820192',
      email: 'fernando.alvarado@usfx.bo',
      phone: '71234508',
      type: 'DOCENTE',
      institution: 'Facultad de Derecho - USFX',
      career: 'Docente de Teoría General del Proceso',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100%
    },
    {
      firstName: 'Mariana Lucía',
      lastName: 'Torrico Flores',
      ci: '8492019',
      email: 'mariana.torrico@usfx.bo',
      phone: '71234509',
      type: 'ESTUDIANTE',
      institution: 'USFX - Carrera de Derecho',
      career: 'Derecho',
      semester: '10mo Semestre',
      sessionsAttended: [s1.id, s2.id, s3.id, s4.id], // 100%
    },
    {
      firstName: 'Javier Ignacio',
      lastName: 'Bustamante Soto',
      ci: '7291048',
      email: 'javier.bustamante@usfx.bo',
      phone: '71234510',
      type: 'ESTUDIANTE',
      institution: 'USFX - Carrera de Derecho',
      career: 'Derecho',
      semester: '7mo Semestre',
      sessionsAttended: [s1.id, s3.id], // 50%
    },
  ];

  for (const att of attendees) {
    const qrToken = `qr-${att.ci}-${crypto.randomBytes(6).toString('hex')}`;
    const participant = await prisma.participant.upsert({
      where: { eventId_ci: { eventId: congress.id, ci: att.ci } },
      update: {
        firstName: att.firstName,
        lastName: att.lastName,
        email: att.email,
        phone: att.phone,
        type: att.type,
        institution: att.institution,
        career: att.career,
        semester: att.semester ?? null,
      },
      create: {
        eventId: congress.id,
        firstName: att.firstName,
        lastName: att.lastName,
        ci: att.ci,
        email: att.email,
        phone: att.phone,
        type: att.type,
        institution: att.institution,
        career: att.career,
        semester: att.semester ?? null,
        qrToken,
        dataConsentAt: new Date(),
        source: 'ONLINE',
      },
    });

    // Register session attendance records
    for (const sessId of att.sessionsAttended) {
      await prisma.attendance.upsert({
        where: {
          participantId_sessionId: {
            participantId: participant.id,
            sessionId: sessId,
          },
        },
        update: {},
        create: {
          participantId: participant.id,
          sessionId: sessId,
          method: 'QR',
          scannedAt: new Date(),
        },
      });
    }
  }
  console.log(`✓ ${attendees.length} Attendees registered with varied roles and check-in records`);

  // 7. Second Event: Seminario de Inteligencia Artificial y Derecho (Híbrido)
  const seminarSlug = 'seminario-ia-y-derecho-2026';
  const seminar = await prisma.event.upsert({
    where: { slug: seminarSlug },
    update: {
      status: 'ABIERTO',
      capacity: 200,
      registrationDeadline: new Date('2026-12-15T23:59:59Z'),
      location: 'Salón del Rectorado y Sala Virtual Zoom',
      modality: 'HIBRIDO',
      isFree: true,
      issuesCertificate: true,
      contactWhatsapp: '67635450',
    },
    create: {
      slug: seminarSlug,
      title: 'Seminario: Inteligencia Artificial, Ética y Práctica Jurídica',
      eventKind: 'Seminario',
      institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
      commemoration: 'Jornadas de Innovación Tecnológica Aplicada a las Ciencias Sociales',
      organizer: 'Instituto de Investigaciones Jurídicas - USFX',
      audienceNote: 'Participación abierta de manera presencial o remota previa inscripción.',
      description:
        'Análisis del impacto de los modelos de lenguaje y herramientas de automatización en la redacción judicial, ética forense y protección de datos.',
      location: 'Salón del Rectorado y Sala Virtual Zoom',
      modality: 'HIBRIDO',
      capacity: 200,
      registrationDeadline: new Date('2026-12-15T23:59:59Z'),
      status: 'ABIERTO',
      isFree: true,
      contactWhatsapp: '67635450',
      issuesCertificate: true,
      minAttendancePercent: 80,
      requireCareer: false,
      requireSemester: false,
      requireInstitution: false,
      requirePhone: true,
      createdBy: admin.id,
    },
  });

  await prisma.session.deleteMany({ where: { eventId: seminar.id } });
  await prisma.session.create({
    data: {
      eventId: seminar.id,
      label: 'Jornada Única: IA en la Práctica Jurídica',
      location: 'Salón del Rectorado / Transmisión Streaming',
      startsAt: new Date('2026-12-10T15:00:00Z'),
      endsAt: new Date('2026-12-10T19:30:00Z'),
      selfCheckinOpen: true,
    },
  });

  await prisma.speaker.deleteMany({ where: { eventId: seminar.id } });
  await prisma.speaker.create({
    data: {
      eventId: seminar.id,
      fullName: 'Dr. Roberto Mendoza Salinas',
      titleProfession: 'Experto en Derecho Digital y Ciberseguridad',
      role: 'EXPOSITOR',
      institution: 'Red Iberoamericana de Derecho Informático',
      position: 0,
    },
  });
  console.log('✓ Second event verified:', seminar.title, `(${seminar.slug})`);

  console.log('\n======================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('• Admin:       jose.rios.usfx1@gmail.com');
  console.log('• Events:      2 Active Events (ABIERTO)');
  console.log('  1. Congreso Internacional de Derecho (350 cupos, 4 salas/tracks, 10 inscritos)');
  console.log('  2. Seminario de Inteligencia Artificial y Derecho (200 cupos, Híbrido)');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error('SEEDING_ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
