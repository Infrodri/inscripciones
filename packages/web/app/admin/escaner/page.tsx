'use client';

import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { isSessionActiveNow } from '@/lib/scanWindow';
import { formatFechaHora } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Table';
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
  if (!data || data.length === 0)
    return (
      <div>
        <PageHeader titulo="Escáner" />
        <div className="mt-4">
          <EmptyState mensaje="Aún no hay eventos." />
        </div>
      </div>
    );

  return (
    <div>
      <PageHeader titulo="Escáner" />
      <div className="mt-4 space-y-4">
        {data.map((event) => (
          <Card key={event.id}>
            <p className="font-medium">{event.title}</p>
            <p className="mt-1">
              <Badge tono={event.status}>{event.status}</Badge>
            </p>
            {event.sessions.length === 0 ? (
              <p className="mt-2 text-sm">Sin sesiones.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {event.sessions.map((s) => {
                  const active = isSessionActiveNow(
                    now,
                    s.startsAt,
                    s.endsAt,
                    event.checkinWindowMinutes
                  );
                  return (
                    <li key={s.id} className="rounded-[8px] bg-[#F5F6F9] p-2 text-sm">
                      <span>
                        {s.label ? `${s.label} — ` : ''}
                        {formatFechaHora(s.startsAt)}{' '}
                        {active ? <Badge tono="ok">Activa ahora</Badge> : null}
                      </span>
                      <div className="mt-1">
                        <SessionScanActions sessionId={s.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
