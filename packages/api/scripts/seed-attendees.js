const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://inscripciones:inscripciones@localhost:5434/inscripciones';
const prisma = new PrismaClient();

const eventId = '23753f72-72c2-4c75-9771-c4cf2355f578';

const participantsData = [
  {
    firstName: 'Carlos Fernando',
    lastName: 'Mendoza Rojas',
    ci: '10482910',
    email: 'carlos.mendoza@usfx.bo',
    phone: '71234561',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Valeria Sofía',
    lastName: 'Romero Gutiérrez',
    ci: '5938201',
    email: 'valeria.romero@usfx.bo',
    phone: '71234562',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Alejandro Javier',
    lastName: 'Morales Daza',
    ci: '7482910',
    email: 'alejandro.morales@usfx.bo',
    phone: '71234563',
    type: 'PROFESIONAL',
  },
  {
    firstName: 'Mariana Lucía',
    lastName: 'Torrico Flores',
    ci: '8492019',
    email: 'mariana.torrico@usfx.bo',
    phone: '71234564',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Rodrigo Gonzalo',
    lastName: 'Peñaranda Ortiz',
    ci: '6928104',
    email: 'rodrigo.penaranda@usfx.bo',
    phone: '71234565',
    type: 'PROFESIONAL',
  },
  {
    firstName: 'Daniela Andrea',
    lastName: 'Campero Salinas',
    ci: '9382014',
    email: 'daniela.campero@usfx.bo',
    phone: '71234566',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Mauricio Andrés',
    lastName: 'Vargas Mercado',
    ci: '8192038',
    email: 'mauricio.vargas@usfx.bo',
    phone: '71234567',
    type: 'PROFESIONAL',
  },
  {
    firstName: 'Gabriela Elena',
    lastName: 'Arancibia Quiroga',
    ci: '1029384',
    email: 'gabriela.arancibia@usfx.bo',
    phone: '71234568',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Javier Ignacio',
    lastName: 'Bustamante Soto',
    ci: '7291048',
    email: 'javier.bustamante@usfx.bo',
    phone: '71234569',
    type: 'ESTUDIANTE',
  },
  {
    firstName: 'Camila Belén',
    lastName: 'Villarroel Paz',
    ci: '8391029',
    email: 'camila.villarroel@usfx.bo',
    phone: '71234570',
    type: 'ESTUDIANTE',
  },
];

async function seed() {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { sessions: { orderBy: { startsAt: 'asc' } }, certificateTemplates: true },
  });
  if (!event) throw new Error('Evento no encontrado');

  console.log('Evento:', event.title);

  // Marcar plantilla asistente como default si no lo está
  const tpl = event.certificateTemplates.find((t) => t.roleKind === 'ASISTENTE');
  if (tpl && !tpl.isDefault) {
    await prisma.certificateTemplate.update({
      where: { id: tpl.id },
      data: { isDefault: true },
    });
    console.log('Plantilla establecida como predeterminada:', tpl.name);
  }

  const s1 = event.sessions[0];
  const s2 = event.sessions[1];

  for (let i = 0; i < participantsData.length; i++) {
    const pData = participantsData[i];
    const participant = await prisma.participant.upsert({
      where: { eventId_ci: { eventId, ci: pData.ci } },
      create: {
        eventId,
        firstName: pData.firstName,
        lastName: pData.lastName,
        ci: pData.ci,
        email: pData.email,
        phone: pData.phone,
        type: pData.type,
        institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
        career: 'Carrera de Derecho',
        semester: '8vo Semestre',
        qrToken: crypto.randomUUID(),
        dataConsentAt: new Date(),
        source: 'ONLINE',
      },
      update: {},
    });

    // 8 de los 10 asistentes (80%) tienen asistencia en ambas sesiones (100% de asistencia >= 80% mínimo -> APTOS)
    // Los otros 2 tienen asistencia en 1 sola sesión (50% < 80% mínimo -> NO APTOS)
    if (i < 8) {
      if (s1) {
        await prisma.attendance.upsert({
          where: { participantId_sessionId: { participantId: participant.id, sessionId: s1.id } },
          create: {
            participantId: participant.id,
            sessionId: s1.id,
            method: 'QR',
            scannedAt: s1.startsAt,
          },
          update: {},
        });
      }
      if (s2) {
        await prisma.attendance.upsert({
          where: { participantId_sessionId: { participantId: participant.id, sessionId: s2.id } },
          create: {
            participantId: participant.id,
            sessionId: s2.id,
            method: 'QR',
            scannedAt: s2.startsAt,
          },
          update: {},
        });
      }
      console.log(
        'Asistente ' +
          (i + 1) +
          ': ' +
          participant.firstName +
          ' ' +
          participant.lastName +
          ' -> 2/2 sesiones (100% - APTO)'
      );
    } else {
      if (s1) {
        await prisma.attendance.upsert({
          where: { participantId_sessionId: { participantId: participant.id, sessionId: s1.id } },
          create: {
            participantId: participant.id,
            sessionId: s1.id,
            method: 'QR',
            scannedAt: s1.startsAt,
          },
          update: {},
        });
      }
      console.log(
        'Asistente ' +
          (i + 1) +
          ': ' +
          participant.firstName +
          ' ' +
          participant.lastName +
          ' -> 1/2 sesiones (50% - NO APTO)'
      );
    }
  }

  const stats = await prisma.participant.count({ where: { eventId } });
  console.log('Total de participantes registrados:', stats);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
