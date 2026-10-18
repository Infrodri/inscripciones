import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://inscripciones:inscripciones@localhost:5434/inscripciones';

process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();

const MAIN_EVENT_ID = '23753f72-72c2-4c75-9771-c4cf2355f578';
const MAIN_EVENT_SLUG = 'congreso-derecho-2026';

const PROTECTED_SLUGS = new Set([
  MAIN_EVENT_SLUG,
  'conversatorio-ley-denuncias-falsas-2026',
  'conversatorio-ley-denuncias-falsas-2026-dia-2',
  'seminario-estado-de-derecho-y-justicia-penal-en-bolivia',
  'facultad',
]);

const PROTECTED_EVENT_IDS = new Set([MAIN_EVENT_ID]);

interface CleanupSummary {
  eventsDeleted: number;
  attendancesDeleted: number;
  recipientsDeleted: number;
  templatesDeleted: number;
  participantsDeleted: number;
  speakersDeleted: number;
  sponsorsDeleted: number;
  sessionsDeleted: number;
  auditLogsDeleted: number;
  uploadDirsRemoved: number;
}

export async function cleanupTestEvents(): Promise<CleanupSummary> {
  const allEvents = await prisma.event.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
    },
  });

  const testEvents = allEvents.filter((event) => {
    if (PROTECTED_EVENT_IDS.has(event.id) || PROTECTED_SLUGS.has(event.slug)) {
      return false;
    }
    const titleMatch =
      event.title === 'Evento H1' ||
      event.title === 'Copia H1' ||
      event.title.startsWith('Evento E2E');
    const slugMatch = event.slug.startsWith('h1-') || event.slug.startsWith('e2e-');

    return titleMatch || slugMatch;
  });

  if (testEvents.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No test garbage events found to delete.');
    return {
      eventsDeleted: 0,
      attendancesDeleted: 0,
      recipientsDeleted: 0,
      templatesDeleted: 0,
      participantsDeleted: 0,
      speakersDeleted: 0,
      sponsorsDeleted: 0,
      sessionsDeleted: 0,
      auditLogsDeleted: 0,
      uploadDirsRemoved: 0,
    };
  }

  const testEventIds = testEvents.map((e) => e.id);
  // eslint-disable-next-line no-console
  console.log(`Found ${testEvents.length} test events to delete.`);

  const summary = await prisma.$transaction(async (tx) => {
    const testSessions = await tx.session.findMany({
      where: { eventId: { in: testEventIds } },
      select: { id: true },
    });
    const testSessionIds = testSessions.map((s) => s.id);

    const testParticipants = await tx.participant.findMany({
      where: { eventId: { in: testEventIds } },
      select: { id: true },
    });
    const testParticipantIds = testParticipants.map((p) => p.id);

    // 1. Delete Attendances (linked by session or participant)
    const delAttendances = await tx.attendance.deleteMany({
      where: {
        OR: [{ sessionId: { in: testSessionIds } }, { participantId: { in: testParticipantIds } }],
      },
    });

    // 2. Delete Certificate Recipients
    const delRecipients = await tx.certificateRecipient.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 3. Delete Certificate Templates
    const delTemplates = await tx.certificateTemplate.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 4. Delete Participants
    const delParticipants = await tx.participant.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 5. Delete Speakers
    const delSpeakers = await tx.speaker.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 6. Delete Sponsors
    const delSponsors = await tx.sponsor.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 7. Delete Sessions
    const delSessions = await tx.session.deleteMany({
      where: { eventId: { in: testEventIds } },
    });

    // 8. Delete Audit Logs
    const delAuditLogs = await tx.auditLog.deleteMany({
      where: { entityId: { in: testEventIds } },
    });

    // 9. Delete Events
    const delEvents = await tx.event.deleteMany({
      where: { id: { in: testEventIds } },
    });

    return {
      eventsDeleted: delEvents.count,
      attendancesDeleted: delAttendances.count,
      recipientsDeleted: delRecipients.count,
      templatesDeleted: delTemplates.count,
      participantsDeleted: delParticipants.count,
      speakersDeleted: delSpeakers.count,
      sponsorsDeleted: delSponsors.count,
      sessionsDeleted: delSessions.count,
      auditLogsDeleted: delAuditLogs.count,
      uploadDirsRemoved: 0,
    };
  });

  // Clean up any test event upload directories
  let uploadDirsRemoved = 0;
  const projectRoot = path.resolve(__dirname, '..');
  const bannerBase = path.join(projectRoot, 'uploads', 'public', 'banners');
  const templateBase = path.join(projectRoot, 'uploads', 'private', 'templates');

  for (const eventId of testEventIds) {
    const bannerDir = path.join(bannerBase, eventId);
    if (fs.existsSync(bannerDir)) {
      try {
        fs.rmSync(bannerDir, { recursive: true, force: true });
        uploadDirsRemoved++;
      } catch {
        // ignore upload cleanup errors
      }
    }
    const tplDir = path.join(templateBase, eventId);
    if (fs.existsSync(tplDir)) {
      try {
        fs.rmSync(tplDir, { recursive: true, force: true });
        uploadDirsRemoved++;
      } catch {
        // ignore upload cleanup errors
      }
    }
  }

  summary.uploadDirsRemoved = uploadDirsRemoved;
  return summary;
}

export async function verifyMainEvent(): Promise<void> {
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ id: MAIN_EVENT_ID }, { slug: MAIN_EVENT_SLUG }],
    },
    include: {
      sessions: { orderBy: { startsAt: 'asc' } },
      participants: { select: { id: true, firstName: true, lastName: true, ci: true } },
      speakers: true,
      certificateTemplates: true,
    },
  });

  if (!event) {
    throw new Error(`Main event not found: ${MAIN_EVENT_SLUG} (${MAIN_EVENT_ID})`);
  }

  // eslint-disable-next-line no-console
  console.log('\n--- ACTIVE MAIN EVENT VERIFICATION ---');
  // eslint-disable-next-line no-console
  console.log(`ID: ${event.id}`);
  // eslint-disable-next-line no-console
  console.log(`Title: "${event.title}"`);
  // eslint-disable-next-line no-console
  console.log(`Slug: ${event.slug}`);
  // eslint-disable-next-line no-console
  console.log(`Status: ${event.status}`);

  if (event.status !== 'ABIERTO') {
    throw new Error(`Expected event status ABIERTO, found: ${event.status}`);
  }

  const now = new Date();
  if (event.registrationDeadline && event.registrationDeadline < now) {
    throw new Error(
      `Registration deadline is in the past: ${event.registrationDeadline.toISOString()}`
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `Registration Deadline: ${
      event.registrationDeadline ? event.registrationDeadline.toISOString() : 'None (open)'
    } (Active/Valid)`
  );

  // eslint-disable-next-line no-console
  console.log(`Sessions count: ${event.sessions.length}`);
  for (const s of event.sessions) {
    const isFuture = s.startsAt > now;
    // eslint-disable-next-line no-console
    console.log(
      `  - [${s.id}] startsAt=${s.startsAt.toISOString()} label="${s.label ?? ''}" (future: ${isFuture})`
    );
  }
  if (event.sessions.length === 0) {
    throw new Error('Main event has no sessions configured.');
  }

  // eslint-disable-next-line no-console
  console.log(`Participants count: ${event.participants.length}`);
  if (event.participants.length !== 10) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: Expected 10 participants, found ${event.participants.length}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('10 registered participants verified successfully.');
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('=== STARTING TEST EVENTS CLEANUP ===');
  const summary = await cleanupTestEvents();
  // eslint-disable-next-line no-console
  console.log('\n--- CLEANUP SUMMARY ---');
  // eslint-disable-next-line no-console
  console.log(`- Events deleted: ${summary.eventsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Sessions deleted: ${summary.sessionsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Speakers deleted: ${summary.speakersDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Sponsors deleted: ${summary.sponsorsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Certificate Templates deleted: ${summary.templatesDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Certificate Recipients deleted: ${summary.recipientsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Participants deleted: ${summary.participantsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Attendances deleted: ${summary.attendancesDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Audit Logs deleted: ${summary.auditLogsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`- Upload directories removed: ${summary.uploadDirsRemoved}`);

  await verifyMainEvent();
  // eslint-disable-next-line no-console
  console.log('\n=== CLEANUP COMPLETED SUCCESSFULLY ===');
}

if (process.argv[1] && process.argv[1].includes('cleanup-test-events')) {
  main()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Cleanup failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
