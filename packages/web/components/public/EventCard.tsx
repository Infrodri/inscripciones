'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import type { PublicEvent } from '@/lib/types';
import { formatCosto, formatModality, getProximaSesion } from '@/lib/format';

interface EventCardProps {
  event: PublicEvent;
}

const TZ = 'America/La_Paz';

/** Clave YYYY-MM-DD en hora de La Paz (evita el desfase de toISOString, que usa UTC). */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function EventCard({ event }: EventCardProps) {
  const proximaSesion = getProximaSesion(event.sessions);
  const modalityLabel = formatModality(event.modality);
  const costLabel = formatCosto(event.isFree, event.cost);

  const start = proximaSesion ? new Date(proximaSesion.startsAt) : null;

  const dateLabel = start
    ? new Intl.DateTimeFormat('es-BO', {
        timeZone: TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
        .format(start)
        .replace(',', '')
    : 'Fecha por definir';

  const timeLabel = start
    ? new Intl.DateTimeFormat('es-BO', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(start)
    : '';

  const isFinalizado = event.status === 'FINALIZADO';
  const isHoy = !!start && !isFinalizado && dayKey(start) === dayKey(new Date());

  const description =
    event.description ||
    event.commemoration ||
    `${event.eventKind || 'Evento'} organizado por ${
      event.organizer || event.institution || 'Facultad de Derecho'
    }.`;

  return (
    <Link
      href={`/e/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-soft transition-shadow duration-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:flex-row"
    >
      {/* Afiche: arriba en móvil, a la izquierda desde sm */}
      <div className="relative w-full shrink-0 overflow-hidden bg-canvas sm:w-40 md:w-44">
        <img
          src={event.bannerUrl || '/facultad-derecho-usfx.jpg'}
          alt={`Afiche de ${event.title}`}
          loading="lazy"
          className={`h-52 w-full object-cover sm:h-full sm:min-h-[15rem] ${
            isFinalizado ? 'grayscale opacity-80' : ''
          }`}
        />

        {isHoy && (
          <span className="absolute left-2 top-2 rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-navy shadow-soft">
            Hoy
          </span>
        )}
        {isFinalizado && (
          <span className="absolute left-2 top-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
            Finalizado
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <h3
            title={event.title}
            className="line-clamp-2 text-lg font-semibold leading-snug text-navy group-hover:underline"
          >
            {event.title}
          </h3>

          <p className="line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>
        </div>

        <ul className="space-y-1.5 text-sm text-navy">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            <span className="font-medium capitalize">{dateLabel}</span>
            {timeLabel && <span className="text-muted">{timeLabel} hrs</span>}
          </li>
          <li className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            <span className="truncate">
              {modalityLabel}
              {event.location ? `, ${event.location}` : ''}
            </span>
          </li>
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          {event.isFree ? (
            <span className="rounded-md border border-ok/40 bg-ok-bg px-2.5 py-1 text-xs font-semibold text-ok">
              Gratis
            </span>
          ) : (
            <span className="rounded-md border border-blue/40 bg-blue-bg px-2.5 py-1 text-xs font-semibold text-blue">
              {costLabel}
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy group-hover:text-navy-hover">
            Ver evento
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
