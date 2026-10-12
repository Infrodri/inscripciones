'use client';

import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { isSessionActiveNow } from '@/lib/scanWindow';
import { formatFechaHora } from '@/lib/format';
import { SessionScanActions } from '@/components/admin/SessionScanActions';

interface EventRow {
  id: string;
  title: string;
  status: string;
  checkinWindowMinutes: number;
}

interface SessionRow {
  id: string;
  startsAt: string;
  endsAt: string | null;
  label: string | null;
}

interface EventWithSessions extends EventRow {
  sessions: SessionRow[];
}

async function getEventsWithSessions(): Promise<EventWithSessions[]> {
  const events = (await api.get('/events', { params: { pageSize: 100 } })).data as {
    data: EventRow[];
  };
  return Promise.all(
    events.data.map(async (event) => {
      const sessions = (await api.get(`/sessions/event/${event.id}`)).data as {
        data: SessionRow[];
      };
      return { ...event, sessions: sessions.data };
    })
  );
}

// Vista mínima de solo lectura para STAFF: eventos, sesiones y acceso al escáner.
export default function EscanerPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['escaner-events'],
    queryFn: getEventsWithSessions,
  });
  const now = Date.now();

  if (isLoading) return <p>Cargando eventos…</p>;
  if (isError) return <p>No se pudieron cargar los eventos: {apiErrorMessage(error)}</p>;
  if (!data || data.length === 0) return <p>Aún no hay eventos.</p>;

  return (
    <div>
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Escáner</h1>
      <div className="mt-4 space-y-4">
        {data.map((event) => (
          <section key={event.id} className="rounded border p-3">
            <p className="font-medium">{event.title}</p>
            <p className="text-sm">Estado: {event.status}</p>
            {event.sessions.length === 0 ? (
              <p className="mt-2 text-sm">Sin sesiones.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {event.sessions.map((s) => {
                  const active = isSessionActiveNow(
                    now,
                    s.startsAt,
                    s.endsAt,
                    event.checkinWindowMinutes
                  );
                  return (
                    <li key={s.id} className="text-sm">
                      <span>
                        {s.label ? `${s.label} — ` : ''}
                        {formatFechaHora(s.startsAt)}{' '}
                        {active ? <strong className="text-[#1E7B4F]">· Activa ahora</strong> : null}
                      </span>
                      <div className="mt-1">
                        <SessionScanActions sessionId={s.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
