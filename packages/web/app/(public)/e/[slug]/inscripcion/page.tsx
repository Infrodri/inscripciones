import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistrationForm } from '@/components/RegistrationForm';
import { buildApiBaseUrl } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';

export const dynamic = 'force-dynamic';

const apiBase = (): string =>
  buildApiBaseUrl(process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL);

interface PublicEvent {
  slug: string;
  title: string;
  eventKind: string;
  location: string;
  shareImageUrl: string | null;
  registrationOpen: boolean;
  registrationReason: string;
  registrationDeadline: string | null;
  requireCareer?: boolean;
  requireSemester?: boolean;
  requireInstitution?: boolean;
  requirePhone?: boolean;
  isFree?: boolean;
  cost?: number | null;
  institutionQr?: string | null;
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
  if (!event) return { title: 'Inscripción — Evento no encontrado' };
  return {
    title: `Inscripción — ${event.title}`,
    description: `Formulario oficial de inscripción: ${event.title} (${event.eventKind})`,
    openGraph: {
      title: `Inscripción — ${event.title}`,
      description: `Formulario oficial de inscripción: ${event.title}`,
      images: event.shareImageUrl ? [event.shareImageUrl] : [],
    },
  };
}

export default async function InscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return (
      <main className="mx-auto max-w-2xl my-12 p-8 text-center bg-surface border border-line rounded-xl shadow-soft space-y-3">
        <h1 className="font-serif text-2xl font-bold text-navy">Evento no encontrado</h1>
        <p className="text-muted text-sm">Este evento no existe o ya no se encuentra disponible.</p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-navy px-5 py-2 text-sm font-medium !text-white hover:bg-navy-hover transition-colors"
          >
            Volver a la cartelera
          </Link>
        </div>
      </main>
    );
  }

  if (!event.registrationOpen) {
    return (
      <main className="mx-auto max-w-2xl my-12 p-8 text-center bg-surface border border-line rounded-xl shadow-soft space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warn-bg text-warn">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-navy">Inscripciones no disponibles</h1>
        <p className="text-sm text-ink max-w-md mx-auto">
          {event.registrationReason === 'CERRADA_FECHA' && event.registrationDeadline
            ? `Las inscripciones cerraron el ${formatFechaHora(event.registrationDeadline)}.`
            : event.registrationReason === 'CUPO_LLENO'
              ? 'El cupo para este evento se encuentra agotado.'
              : event.registrationReason === 'CERRADAS_MANUAL'
                ? 'Las inscripciones están cerradas por los organizadores.'
                : 'Las inscripciones no están disponibles por el momento.'}
        </p>
        <div className="pt-2">
          <Link
            href={`/e/${slug}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-navy px-5 py-2 text-sm font-medium !text-white hover:bg-navy-hover transition-colors"
          >
            Ver detalles del evento
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl my-8 px-4 space-y-6">
      <RegistrationForm
        slug={slug}
        required={{
          career: event.requireCareer ?? false,
          semester: event.requireSemester ?? false,
          institution: event.requireInstitution ?? false,
          phone: event.requirePhone ?? false,
        }}
        event={{
          isFree: event.isFree,
          cost: event.cost,
          institutionQr: event.institutionQr,
        }}
      />
    </main>
  );
}
