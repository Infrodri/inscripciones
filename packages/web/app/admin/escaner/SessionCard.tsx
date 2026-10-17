'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { isSessionActiveNow } from '@/lib/scanWindow';
import { formatRangoSesion } from '@/lib/format';
import type { EnrichedSession } from './ProyectarModal';

interface SessionCardProps {
  session: EnrichedSession;
  now: number;
  onProyectar: (session: EnrichedSession) => void;
  onCopiarEnlace: (sessionId: string) => void;
}

export function SessionCard({
  session,
  now,
  onProyectar,
  onCopiarEnlace,
}: SessionCardProps) {
  const isActive = isSessionActiveNow(
    now,
    session.startsAt,
    session.endsAt,
    session.event.checkinWindowMinutes
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-soft transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Lado izquierdo: Datos de la sesión e institucional */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-bold text-ink">
              {session.label || 'Sesión General'}
            </h3>
            <Badge tono={session.event.status}>{session.event.title}</Badge>
            {isActive ? <Badge tono="ok">Activa ahora</Badge> : null}
            <Badge tono="neutro">
              {session.checkedIn} {session.checkedIn === 1 ? 'registrado' : 'registrados'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              📅 {formatRangoSesion(session.startsAt, session.endsAt)}
            </span>
            {session.location ? (
              <span className="inline-flex items-center gap-1.5">
                📍 {session.location}
              </span>
            ) : null}
          </div>
        </div>

        {/* Lado derecho: Botones de acción accesibles */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
          <Button variant="primario" size="sm" asChild>
            <Link href={`/scan/${session.id}`}>Abrir escáner</Link>
          </Button>

          <Button variant="secundario" size="sm" onClick={() => onProyectar(session)}>
            Proyectar QR
          </Button>

          <Button variant="fantasma" size="sm" onClick={() => onCopiarEnlace(session.id)}>
            Copiar enlace
          </Button>
        </div>
      </div>
    </div>
  );
}
