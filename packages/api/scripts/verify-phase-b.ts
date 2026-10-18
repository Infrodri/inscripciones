import { PrismaClient } from '@prisma/client';
import { attendancePercentage, isEligible } from '../src/application/attendanceService.js';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== VERIFICACIÓN Y SIMULACIÓN FASE B ===\n');

  // 1. Sectorial Event
  const sectorial = await prisma.event.findUnique({
    where: { slug: 'prueba-reunion-nacional-sectorial-derecho-2026' },
    include: {
      sessions: { orderBy: { startsAt: 'asc' } },
      speakers: true,
      participants: {
        include: {
          attendances: true,
        },
      },
      certificateRecipients: true,
      staffAssignments: {
        include: { user: { select: { email: true, role: true } } },
      },
    },
  });

  if (!sectorial) {
    throw new Error('Sectorial event not found!');
  }

  console.log(`Evento: ${sectorial.title}`);
  console.log(`Total Sesiones: ${sectorial.sessions.length}`);
  console.log(`Total Expositores: ${sectorial.speakers.length}`);
  console.log(`Total Organizadores (Recipients): ${sectorial.certificateRecipients.length}`);
  console.log(`Total Participantes: ${sectorial.participants.length}`);
  console.log(
    `Staff Delegado: ${sectorial.staffAssignments.map((s) => `${s.user.email} (${s.accessLevel})`).join(', ')}`
  );

  console.log('\n--- EVALUACIÓN DE APTITUD DE DELEGADOS (P5, P6, P7, P8) ---');
  for (const p of sectorial.participants) {
    const presentCount = p.attendances.filter((a) => !a.voidedAt).length;
    const attendedPercent = attendancePercentage(presentCount, sectorial.sessions.length);
    const eligible = isEligible(
      presentCount,
      sectorial.sessions.length,
      sectorial.minAttendancePercent
    );
    console.log(
      `- ${p.firstName} ${p.lastName} (CI: ${p.ci}): Asistencias=${presentCount}/${sectorial.sessions.length} (${attendedPercent.toFixed(1)}%) -> Apto: ${eligible ? 'SÍ' : 'NO'}`
    );
  }

  // Verificar C.I. con ceros a la izquierda (P2)
  const gabriela = sectorial.participants.find((p) => p.firstName === 'Gabriela');
  console.log(
    `\nP2 - Ceros a la izquierda: CI de Gabriela = "${gabriela?.ci}" (Conserva ceros: ${gabriela?.ci === '00123456' ? 'SÍ' : 'NO'})`
  );

  // Verificar Eventos Retroactivos (Q1, Q8, Q11)
  const e1 = await prisma.event.findUnique({
    where: { slug: 'prueba-transformacion-multilateralismo-onu-2026' },
    include: { speakers: true, sessions: true },
  });
  const e2 = await prisma.event.findUnique({
    where: { slug: 'prueba-analisis-proyecto-ley-denuncias-falsas-2026' },
    include: { speakers: true, sessions: true },
  });
  const e3 = await prisma.event.findUnique({
    where: { slug: 'prueba-estado-derecho-justicia-penal-bolivia-2026' },
    include: { speakers: true, sessions: true },
  });

  console.log('\n--- VERIFICACIÓN EVENTOS RETROACTIVOS (E1, E2, E3) ---');
  console.log(
    `E1 (${e1?.slug}): Status=${e1?.status}, Speakers=${e1?.speakers.length}, Commemoration="${e1?.commemoration}"`
  );
  console.log(
    `E2 (${e2?.slug}): Status=${e2?.status}, Speakers=${e2?.speakers.length}, AudienceNote="${e2?.audienceNote}"`
  );
  console.log(
    `E3 (${e3?.slug}): Status=${e3?.status}, isFree=${e3?.isFree}, Cost=${e3?.cost} Bs, Organizer="${e3?.organizer}"`
  );

  console.log('\n=== FIN DE VERIFICACIÓN FASE B ===');
}

verify()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
