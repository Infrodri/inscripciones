'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight, Clock } from 'lucide-react';
import type { PublicEvent } from '@/lib/types';
import { formatCosto, formatModality, getProximaSesion } from '@/lib/format';

interface EventCardProps {
  event: PublicEvent;
}

export function EventCard({ event }: EventCardProps) {
  const proximaSesion = getProximaSesion(event.sessions);
  const modalityLabel = formatModality(event.modality);
  const costLabel = formatCosto(event.isFree, event.cost);

  return (
    <Link
      href={`/e/${event.slug}`}
      className="group block relative bg-surface border-2 border-line hover:border-gold rounded-xl p-5 sm:p-6 transition-all duration-200 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-gold"
    >
      <div className="flex flex-col h-full justify-between space-y-4">
        {/* Top Badges */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-canvas text-navy border border-line">
                {event.eventKind || 'Evento'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-canvas text-muted border border-line">
                {modalityLabel}
              </span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                event.isFree
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-gold/15 text-navy dark:text-gold border border-gold/30'
              }`}
            >
              {costLabel}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-lg font-bold text-ink group-hover:text-gold transition-colors leading-snug">
            {event.title}
          </h3>

          {/* Institution or Organizer */}
          {(event.institution || event.organizer) && (
            <p className="text-xs text-muted font-medium line-clamp-1">
              {event.institution || event.organizer}
            </p>
          )}
        </div>

        {/* Middle Metadata (Session & Location) */}
        <div className="space-y-2 pt-2 border-t border-line text-xs text-muted">
          {proximaSesion ? (
            <div className="flex items-center gap-2 text-ink">
              <CalendarDays className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
              <span>
                {new Date(proximaSesion.startsAt).toLocaleDateString('es-BO', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                —{' '}
                {new Date(proximaSesion.startsAt).toLocaleTimeString('es-BO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Fechas por confirmar</span>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}
        </div>

        {/* Bottom Status & CTA */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-line text-xs">
          <div className="flex items-center gap-1.5">
            {event.registrationOpen ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Inscripciones abiertas
                {typeof event.spotsLeft === 'number' && event.spotsLeft <= 20 && (
                  <span className="ml-1 font-bold">({event.spotsLeft} cupos)</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px] bg-canvas text-muted">
                {event.registrationReason === 'FULL'
                  ? 'Cupos agotados'
                  : event.registrationReason === 'PAST_DEADLINE'
                    ? 'Plazo concluido'
                    : 'Inscripciones cerradas'}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold group-hover:translate-x-0.5 transition-transform">
            Ver detalles
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
