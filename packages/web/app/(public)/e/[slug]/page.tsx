import type { Metadata } from 'next';
import Image from 'next/image';
import { buildApiBaseUrl } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { CopyBroadcastButton } from '@/components/CopyBroadcastButton';
import { RegistrationForm } from '@/components/RegistrationForm';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
  audienceNote: string | null;
  description: string | null;
  location: string;
  mapUrl: string | null;
  modality: string;
  status: string;
  contactWhatsapp: string | null;
  bannerUrl: string | null;
  shareImageUrl: string | null;
  sessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    label: string | null;
  }>;
  speakers: Array<{
    id: string;
    fullName: string;
    titleProfession: string | null;
    role: string;
    institution?: string | null;
  }>;
  sponsors?: Array<{
    id: string;
    name: string;
    position?: number;
  }>;
  spotsLeft: number | null;
  registrationOpen: boolean;
  registrationReason: string;
  registrationDeadline: string | null;
  capacity: number | null;
  issuesCertificate: boolean;
  isFree?: boolean;
  cost?: number | null;
  institutionQr?: string | null;
  requireCareer?: boolean;
  requireSemester?: boolean;
  requireInstitution?: boolean;
  requirePhone?: boolean;
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
      <main className="mx-auto max-w-2xl my-12 p-8 text-center bg-surface border border-line rounded-xl shadow-soft space-y-3">
        <h1 className="font-serif text-2xl font-bold text-navy">Evento no encontrado</h1>
        <p className="text-muted text-sm">Este evento no existe o ya no se encuentra disponible.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl my-8 px-4 space-y-6">
      {event.bannerUrl ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <Image
            src={event.bannerUrl}
            alt={`Afiche de ${event.title}`}
            width={1200}
            height={600}
            className="w-full object-cover max-h-[360px]"
            priority
            unoptimized
          />
        </div>
      ) : null}

      <Card className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-soft space-y-6">
        <div className="border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">
            {event.institution}
          </p>
          {event.commemoration ? (
            <p className="mt-0.5 text-xs italic text-muted">{event.commemoration}</p>
          ) : null}
          <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-navy leading-tight">
            {event.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              Organizado por <strong className="text-ink font-medium">{event.organizer}</strong>
            </span>
            {event.audienceNote ? (
              <span className="text-xs bg-canvas text-muted px-2.5 py-0.5 rounded-full border border-line">
                Dirigido a: {event.audienceNote}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tono={event.status}>{event.status}</Badge>
          <Badge tono="neutro">{event.modality}</Badge>
          <Badge tono="neutro">{event.eventKind}</Badge>
          {event.isFree === false ? (
            <Badge tono="aviso">Costo: {event.cost != null ? `${event.cost} Bs` : 'De pago'}</Badge>
          ) : (
            <Badge tono="ok">Ingreso Gratuito</Badge>
          )}
          {event.issuesCertificate ? (
            <Badge tono="ok">Emite Certificado Académico</Badge>
          ) : null}
          {event.spotsLeft !== null ? (
            <Badge tono={event.spotsLeft > 0 ? 'neutro' : 'error'}>
              {event.spotsLeft > 0 ? `${event.spotsLeft} cupos disponibles` : 'Cupo agotado'}
            </Badge>
          ) : null}
        </div>

        {event.description ? (
          <div className="text-ink text-sm sm:text-base leading-relaxed whitespace-pre-line border-t border-line/50 pt-4">
            {event.description}
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2 text-sm border-t border-line pt-5">
          <div className="space-y-2">
            <p className="font-semibold text-navy flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Fechas y Horarios</span>
            </p>
            {event.sessions && event.sessions.length > 0 ? (
              <ul className="space-y-2 text-ink">
                {event.sessions.map((s) => (
                  <li key={s.id} className="bg-canvas/60 rounded-lg p-2.5 border border-line/60">
                    {s.label ? (
                      <p className="font-medium text-xs text-navy uppercase tracking-wide mb-0.5">
                        {s.label}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium">
                      {formatFechaHora(s.startsAt)}
                      {s.endsAt ? ` — ${formatFechaHora(s.endsAt).split(' · ')[1] ?? formatFechaHora(s.endsAt)}` : ''}
                    </p>
                    {s.location ? (
                      <p className="text-xs text-muted mt-0.5">{s.location}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted italic">Horarios por confirmar</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-navy flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Ubicación y Salón</span>
            </p>
            <div className="bg-canvas/60 rounded-lg p-2.5 border border-line/60 space-y-1">
              <p className="text-ink font-medium">{event.location}</p>
              {event.mapUrl ? (
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-navy-hover underline font-medium"
                >
                  Ver en Google Maps
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {event.speakers && event.speakers.length > 0 ? (
          <div className="border-t border-line pt-5 space-y-3">
            <h2 className="font-serif text-lg font-bold text-navy flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Expositores y Ponentes</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {event.speakers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-line bg-canvas/40 p-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink text-sm">{s.fullName}</p>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface border border-line text-navy shrink-0">
                        {s.role}
                      </span>
                    </div>
                    {s.titleProfession ? (
                      <p className="text-xs text-muted mt-0.5">{s.titleProfession}</p>
                    ) : null}
                    {s.institution ? (
                      <p className="text-xs text-muted/80">{s.institution}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {event.sponsors && event.sponsors.length > 0 ? (
          <div className="border-t border-line pt-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Auspiciadores e Instituciones Cooperantes
            </h3>
            <div className="flex flex-wrap gap-2">
              {event.sponsors.map((sp) => (
                <span
                  key={sp.id}
                  className="inline-flex items-center rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink shadow-soft"
                >
                  {sp.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {event.contactWhatsapp ? (
          <div className="border-t border-line pt-4 flex items-center justify-between flex-wrap gap-2 text-sm">
            <span className="text-muted">¿Consultas o información adicional?</span>
            <a
              href={`https://wa.me/${event.contactWhatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-navy-hover hover:underline"
            >
              <span>WhatsApp: {event.contactWhatsapp}</span>
            </a>
          </div>
        ) : null}
      </Card>

      {event.registrationOpen ? (
        <RegistrationForm
          slug={event.slug}
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
      ) : (
        <Card className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-soft text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warn-bg text-warn">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="font-serif text-lg font-bold text-navy">
            {event.registrationReason === 'CERRADA_FECHA' && event.registrationDeadline
              ? `Las inscripciones cerraron el ${formatFechaHora(event.registrationDeadline)}.`
              : event.registrationReason === 'CUPO_LLENO'
                ? 'El cupo para este evento se encuentra agotado.'
                : event.registrationReason === 'CERRADAS_MANUAL'
                  ? 'Las inscripciones están cerradas por los organizadores.'
                  : 'Las inscripciones no están disponibles por el momento.'}
          </p>
          <p className="text-sm text-muted max-w-md mx-auto">
            Los detalles y programa del evento continúan visibles arriba. Si ya completó su registro previo, conserve su comprobante y código QR para el ingreso.
          </p>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <CopyBroadcastButton slug={event.slug} />
      </div>
    </main>
  );
}

