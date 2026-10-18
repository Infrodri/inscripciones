'use client';

import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import type { PublicEvent } from '@/lib/types';
import { formatCosto, formatModality, getProximaSesion } from '@/lib/format';

interface EventCardProps {
  event: PublicEvent;
}

export function EventCard({ event }: EventCardProps) {
  const proximaSesion = getProximaSesion(event.sessions);
  const modalityLabel = formatModality(event.modality);
  const costLabel = formatCosto(event.isFree, event.cost);

  const formattedDate = proximaSesion
    ? new Date(proximaSesion.startsAt).toISOString().slice(0, 10)
    : 'Por definir';

  const formattedTime = proximaSesion
    ? new Date(proximaSesion.startsAt).toLocaleTimeString('es-BO', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  const isFinalizado = event.status === 'FINALIZADO';

  return (
    <Link
      href={`/e/${event.slug}`}
      className={`group flex flex-row relative bg-surface border border-line rounded-xl overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold ${
        isFinalizado
          ? 'border-l-[8px] border-l-muted opacity-85 hover:opacity-100'
          : 'border-l-[8px] border-l-navy'
      }`}
    >
      {/* Columna Izquierda: Afiche / Portada (35-40%) */}
      <div className="relative w-32 xs:w-36 sm:w-40 md:w-44 shrink-0 bg-canvas overflow-hidden flex flex-col justify-between">
        <img
          src={event.bannerUrl || '/facultad-derecho-usfx.jpg'}
          alt={`Afiche de ${event.title}`}
          className="w-full h-full min-h-[14rem] sm:min-h-[16rem] object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Badge USFX en la esquina superior izquierda */}
        <div className="absolute top-0 left-0 flex flex-col items-start select-none">
          <span className="bg-navy text-white text-[11px] font-bold px-2.5 py-1 rounded-br-lg shadow-sm tracking-wider uppercase">
            USFX
          </span>
          {/* Badge de precio si es de pago */}
          {!event.isFree && event.cost && (
            <span className="mt-0.5 bg-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg shadow-sm">
              {Number(event.cost).toFixed(2)} Bs
            </span>
          )}
        </div>
      </div>

      {/* Columna Derecha: Datos y Botón Acceder (60-65%) */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between space-y-2 min-w-0 bg-gradient-to-t from-canvas/40 via-surface to-surface">
        <div className="space-y-2">
          {/* Cabecera / Banner con título */}
          <div className="rounded bg-gradient-to-r from-navy via-navy to-blue px-2.5 py-1.5 shadow-xs">
            <h3
              className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight line-clamp-1 group-hover:underline"
              title={event.title}
            >
              {event.title}
            </h3>
          </div>

          {/* Fecha y Hora en formato USFX */}
          <div className="flex items-center gap-1.5 text-xs text-navy font-bold">
            <CalendarDays className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
            <span>{formattedDate}</span>
            {formattedTime && (
              <span className="font-normal text-muted text-[11px]">{formattedTime} .Hrs</span>
            )}
          </div>

          {/* Breve descripción o referencia */}
          <p className="text-xs text-muted line-clamp-2 leading-relaxed">
            {event.description ||
              event.commemoration ||
              `${event.eventKind || 'Evento'} organizado por ${event.organizer || event.institution || 'Facultad de Derecho'}.`}
          </p>

          {/* Modalidad y Ubicación */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted pt-0.5">
            <span className="px-2 py-0.5 rounded-full bg-canvas border border-line font-medium text-[10px]">
              {modalityLabel}
            </span>
            {event.location && (
              <span className="line-clamp-1 flex items-center gap-1 text-[11px]">
                <MapPin className="h-3 w-3 text-gold/80 shrink-0" aria-hidden="true" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Fila Inferior: Botón Acceder y Badge Gratis/Pago/Finalizado */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/60">
          <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-md bg-navy text-white text-xs font-bold shadow-soft group-hover:bg-navy-hover transition-colors select-none">
            Acceder
          </span>

          <div className="select-none">
            {isFinalizado ? (
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-canvas text-muted border border-line">
                Finalizado
              </span>
            ) : event.isFree ? (
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-ok-bg text-ok border border-ok/40">
                Gratis
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-bg text-blue border border-blue/40">
                {costLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

