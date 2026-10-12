import { PrismaClient } from '@prisma/client';
import { referenceEventSeed, secondEventSeed, testParticipants } from '../tests/fixtures.js';

const prisma = new PrismaClient();

// Evento de referencia + segundo evento TEST. Bloqueado en producción sin --force.
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('seed:reference está bloqueado en producción sin --force');
  }
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No hay ADMIN: ejecute primero npm run seed');

  const reference = await prisma.event.upsert({
    where: { slug: referenceEventSeed.slug },
    update: {},
    create: {
      slug: referenceEventSeed.slug,
      title: referenceEventSeed.title,
      eventKind: referenceEventSeed.eventKind,
      institution: referenceEventSeed.institution,
      commemoration: referenceEventSeed.commemoration,
      organizer: referenceEventSeed.organizer,
      location: referenceEventSeed.location,
      modality: 'PRESENCIAL',
      status: 'BORRADOR',
      isFree: true,
      contactWhatsapp: referenceEventSeed.contactWhatsapp,
      issuesCertificate: true,
      createdBy: admin.id,
    },
  });
  await prisma.session.deleteMany({ where: { eventId: reference.id } });
  await prisma.session.create({
    data: {
      eventId: reference.id,
      startsAt: new Date(referenceEventSeed.sessionStartsAt),
      endsAt: null,
    },
  });
  for (const [index, speaker] of referenceEventSeed.speakers.entries()) {
    await prisma.speaker.create({
      data: {
        eventId: reference.id,
        fullName: speaker.fullName,
        titleProfession: speaker.titleProfession,
        role: speaker.role as 'EXPOSITOR' | 'MODERADOR',
        position: index,
      },
    });
  }

  const second = await prisma.event.upsert({
    where: { slug: secondEventSeed.slug },
    update: {},
    create: {
      slug: secondEventSeed.slug,
      title: secondEventSeed.title,
      eventKind: referenceEventSeed.eventKind,
      institution: referenceEventSeed.institution,
      commemoration: referenceEventSeed.commemoration,
      organizer: referenceEventSeed.organizer,
      location: referenceEventSeed.location,
      modality: 'PRESENCIAL',
      status: 'BORRADOR',
      isFree: true,
      createdBy: admin.id,
    },
  });
  await prisma.session.deleteMany({ where: { eventId: second.id } });
  for (const startsAt of secondEventSeed.sessionStarts) {
    await prisma.session.create({
      data: { eventId: second.id, startsAt: new Date(startsAt), endsAt: null },
    });
  }
  for (const participant of testParticipants) {
    await prisma.participant.upsert({
      where: { qrToken: `seed-${participant.ci}` },
      update: {},
      create: {
        eventId: second.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        ci: participant.ci,
        email: participant.email,
        type: 'PUBLICO',
        qrToken: `seed-${participant.ci}`,
        dataConsentAt: new Date(),
        source: 'ONLINE',
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Reference OK: ${reference.slug}, ${second.slug}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
