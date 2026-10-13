import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildApiBaseUrl } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { CopyBroadcastButton } from '@/components/CopyBroadcastButton';

export const dynamic = 'force-dynamic';

const apiBase = (): string =>
  buildApiBaseUrl(process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL);

interface PublicEvent {
  slug: string;
  title: string;
  eventKind: string;
  institution: string;
  commemoration: string | null;
  organizer: string;
  location: string;
  status: string;
  contactWhatsapp: string | null;
  bannerUrl: string | null;
  shareImageUrl: string | null;
  description: string | null;
  sessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    label: string | null;
  }>;
  speakers: Array<{ id: string; fullName: string; titleProfession: string | null; role: string }>;
  spotsLeft: number | null;
  registrationOpen: boolean;
  registrationReason: string;
  registrationDeadline: string | null;
  capacity: number | null;
  issuesCertificate: boolean;
}

async function getEvent(slug: string): Promise<PublicEvent | null> {
  const res = await fetch(`${apiBase()}/public/events/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as PublicEvent;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: 'Evento no encontrado' };
  return {
    title: event.title,
    description: `${event.eventKind} — ${event.location}`,
    openGraph: {
      title: event.title,
      description: `${event.eventKind} — ${event.location}`,
      images: event.shareImageUrl ? [event.shareImageUrl] : [],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Este evento no existe o ya no está disponible.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl p-6">
      {event.bannerUrl ? (
        <Image
          src={event.bannerUrl}
          alt={`Afiche de ${event.title}`}
          width={1200}
          height={600}
          className="w-full rounded"
          priority
        />
      ) : (
        <header className="border-b-4 border-[#C9A227] pb-4">
          <p className="text-sm text-[#0A2A5E]">{event.institution}</p>
          {event.commemoration ? <p className="text-sm italic">{event.commemoration}</p> : null}
          <h1 className="font-serif text-3xl text-[#0A2A5E]">{event.title}</h1>
        </header>
      )}
      <h1 className="mt-6 font-serif text-3xl text-[#0A2A5E]">{event.title}</h1>
      <p className="mt-1 text-sm">{event.organizer}</p>
      <p className="mt-4">{event.location}</p>
      {event.issuesCertificate ? (
        <p className="mt-2 text-sm text-[#0A2A5E]">Este evento emite certificados de asistencia.</p>
      ) : null}
      <ul className="mt-2">
        {event.sessions.map((s) => (
          <li key={s.id}>
            {formatFechaHora(s.startsAt)}
            {s.location ? ` — ${s.location}` : ''}
          </li>
        ))}
      </ul>
      {event.speakers.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-serif text-xl text-[#0A2A5E]">Expositores</h2>
          <ul>
            {event.speakers.map((s) => (
              <li key={s.id}>
                {s.fullName}
                {s.titleProfession ? ` — ${s.titleProfession}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {event.registrationOpen ? (
        <Link
          href={`/e/${event.slug}/inscripcion`}
          className="mt-6 inline-block min-h-[44px] rounded bg-[#0A2A5E] px-6 py-3 text-lg text-white"
        >
          Inscribirme{event.spotsLeft !== null ? ` (${event.spotsLeft} cupos)` : ''}
        </Link>
      ) : (
        <div className="mt-6 rounded-[8px] border border-[#D9DEE7] bg-white p-4">
          <p className="font-medium">
            {event.registrationReason === 'CERRADA_FECHA' && event.registrationDeadline
              ? `Las inscripciones cerraron el ${formatFechaHora(event.registrationDeadline)}.`
              : event.registrationReason === 'CUPO_LLENO'
                ? 'Se llenó el cupo del evento.'
                : event.registrationReason === 'CERRADAS_MANUAL'
                  ? 'Las inscripciones están cerradas por los organizadores.'
                  : 'Las inscripciones están cerradas por el momento.'}
          </p>
          <p className="mt-1 text-sm">
            El afiche y los datos del evento siguen aquí abajo. Si ya te inscribiste, guarda tu
            código QR: lo necesitarás en la puerta.
          </p>
        </div>
      )}
      <div className="mt-6">
        <CopyBroadcastButton slug={event.slug} />
      </div>
    </main>
  );
}
