'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { getSessionCategory } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import { SessionCard } from './SessionCard';
import { ProyectarModal, type EnrichedSession } from './ProyectarModal';

interface EventRow {
  id: string;
  title: string;
  status: string;
  checkinWindowMinutes: number;
}

interface RawSessionRow {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location?: string | null;
  label: string | null;
  selfCheckinOpen?: boolean;
}

interface EventWithSessions extends EventRow {
  sessions: Array<RawSessionRow & { checkedIn: number }>;
}

async function getEventsWithSessions(): Promise<EventWithSessions[]> {
  const events = (await api.get('/events', { params: { pageSize: 100 } })).data as {
    data: EventRow[];
  };

  return Promise.all(
    (events.data ?? []).map(async (event) => {
      const [sessionsRes, statsRes] = await Promise.all([
        api.get(`/sessions/event/${event.id}`),
        api.get(`/events/${event.id}/stats`).catch(() => null),
      ]);

      const rawSessions = (sessionsRes.data as { data: RawSessionRow[] }).data ?? [];
      const perSession = (
        statsRes?.data as { perSession?: Array<{ id: string; checkedIn: number }> } | undefined
      )?.perSession;

      const sessions = rawSessions.map((s) => {
        const statsItem = Array.isArray(perSession)
          ? perSession.find((ps) => ps.id === s.id)
          : undefined;
        return {
          ...s,
          location: s.location ?? null,
          checkedIn: statsItem?.checkedIn ?? 0,
        };
      });

      return { ...event, sessions };
    })
  );
}

// Vista institucional de escáner para STAFF y administradores
export default function EscanerPage() {
  const [mostrarBorradores, setMostrarBorradores] = useState(false);
  const [proyectarSession, setProyectarSession] = useState<EnrichedSession | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['escaner-events'],
    queryFn: getEventsWithSessions,
  });

  const now = Date.now();

  const handleCopiarEnlace = async (sessionId: string): Promise<void> => {
    const origin = (
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    ).replace(/\/+$/, '');
    const url = `${origin}/scan/${sessionId}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Enlace del escáner copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const enrichedSessions = useMemo(() => {
    if (!data) return [];
    const result: EnrichedSession[] = [];
    for (const event of data) {
      if (!mostrarBorradores && event.status === 'BORRADOR') {
        continue;
      }
      for (const session of event.sessions) {
        result.push({
          id: session.id,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          location: session.location ?? null,
          label: session.label,
          selfCheckinOpen: session.selfCheckinOpen,
          checkedIn: session.checkedIn,
          event: {
            id: event.id,
            title: event.title,
            status: event.status,
            checkinWindowMinutes: event.checkinWindowMinutes,
          },
        });
      }
    }
    return result;
  }, [data, mostrarBorradores]);

  const { hoy, proximas, pasadas } = useMemo(() => {
    const hoyList: EnrichedSession[] = [];
    const proximasList: EnrichedSession[] = [];
    const pasadasList: EnrichedSession[] = [];

    const referenceNow = new Date(now);

    for (const s of enrichedSessions) {
      const category = getSessionCategory(s.startsAt, referenceNow);
      if (category === 'hoy') {
        hoyList.push(s);
      } else if (category === 'proximas') {
        proximasList.push(s);
      } else {
        pasadasList.push(s);
      }
    }

    hoyList.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    proximasList.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    pasadasList.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

    return { hoy: hoyList, proximas: proximasList, pasadas: pasadasList };
  }, [enrichedSessions, now]);

  const toggleBorradores = (
    <div className="ml-auto flex items-center gap-2">
      <label
        htmlFor="toggle-borradores"
        className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
      >
        <span>Mostrar borradores</span>
        <button
          type="button"
          id="toggle-borradores"
          role="switch"
          aria-checked={mostrarBorradores}
          onClick={() => setMostrarBorradores((v) => !v)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
            mostrarBorradores ? 'bg-navy' : 'bg-line'
          )}
        >
          <span className="sr-only">Mostrar borradores</span>
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-soft ring-0 transition duration-200 ease-in-out',
              mostrarBorradores ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </label>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader
          titulo="Escáner"
          migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Escáner' }]}
          volverA="/admin/eventos"
        />
        <p className="text-sm text-muted">Cargando eventos y sesiones…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader
          titulo="Escáner"
          migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Escáner' }]}
          volverA="/admin/eventos"
        />
        <p className="text-sm text-danger">
          No se pudieron cargar los eventos: {apiErrorMessage(error)}
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          titulo="Escáner"
          migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Escáner' }]}
          volverA="/admin/eventos"
        />
        <EmptyState mensaje="Aún no hay eventos registrados." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Escáner"
        migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Escáner' }]}
        volverA="/admin/eventos"
        accion={toggleBorradores}
      />

      {enrichedSessions.length === 0 ? (
        <EmptyState
          mensaje={
            mostrarBorradores
              ? 'No hay sesiones disponibles en los eventos registrados.'
              : 'No hay sesiones de eventos activos disponibles. Puedes activar "Mostrar borradores" para revisar eventos en preparación.'
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Bloque 1: "Hoy" (destacado si hay sesiones hoy) */}
          {hoy.length > 0 ? (
            <section aria-labelledby="seccion-hoy" className="space-y-3">
              <div className="flex items-center justify-between rounded-[var(--radius-md)] border-l-4 border-gold bg-surface px-4 py-3 shadow-soft">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-gold"></span>
                  </span>
                  <h2 id="seccion-hoy" className="font-serif text-xl font-bold text-navy">
                    Sesiones de Hoy
                  </h2>
                  <Badge tono="aviso">{hoy.length}</Badge>
                </div>
                <span className="text-xs font-medium text-muted">America/La_Paz</span>
              </div>

              <div className="space-y-3">
                {hoy.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    now={now}
                    onProyectar={setProyectarSession}
                    onCopiarEnlace={handleCopiarEnlace}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Bloque 2: "Próximas" (sesiones futuras) */}
          <section aria-labelledby="seccion-proximas" className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 id="seccion-proximas" className="font-serif text-xl font-bold text-navy">
                Próximas Sesiones
              </h2>
              <Badge tono="neutro">{proximas.length}</Badge>
            </div>

            {proximas.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6 text-center text-sm text-muted">
                No hay sesiones próximas programadas.
              </div>
            ) : (
              <div className="space-y-3">
                {proximas.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    now={now}
                    onProyectar={setProyectarSession}
                    onCopiarEnlace={handleCopiarEnlace}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Bloque 3: "Pasadas" (sesiones anteriores, colapsadas por defecto) */}
          <section aria-labelledby="seccion-pasadas">
            <details className="group rounded-[var(--radius-md)] border border-line bg-surface shadow-soft">
              <summary className="flex cursor-pointer list-none select-none items-center justify-between p-4 font-serif text-lg font-bold text-navy transition-colors hover:bg-canvas">
                <div className="flex items-center gap-2">
                  <h2 id="seccion-pasadas" className="inline text-lg font-bold text-navy">
                    Sesiones Pasadas
                  </h2>
                  <Badge tono="neutro">{pasadas.length}</Badge>
                </div>
                <span className="font-sans text-sm font-normal text-muted transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <div className="space-y-3 border-t border-line p-4">
                {pasadas.length === 0 ? (
                  <p className="text-sm text-muted">No hay sesiones pasadas registradas.</p>
                ) : (
                  pasadas.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      now={now}
                      onProyectar={setProyectarSession}
                      onCopiarEnlace={handleCopiarEnlace}
                    />
                  ))
                )}
              </div>
            </details>
          </section>
        </div>
      )}

      {/* Modal único a nivel de página (UI & Modal Anti-Regression Rule 2) */}
      {proyectarSession && (
        <ProyectarModal
          open={true}
          session={proyectarSession}
          onCerrar={() => setProyectarSession(null)}
          onSelfCheckinToggle={(sessionId, nuevoEstado) => {
            setProyectarSession((prev) =>
              prev && prev.id === sessionId ? { ...prev, selfCheckinOpen: nuevoEstado } : prev
            );
          }}
        />
      )}
    </div>
  );
}
