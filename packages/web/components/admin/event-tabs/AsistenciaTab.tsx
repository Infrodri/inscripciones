'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Table';
import { Switch } from '@/components/ui/Switch';
import { SessionScanActions } from '@/components/admin/SessionScanActions';

interface SessionRow {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  label: string | null;
  selfCheckinOpen: boolean;
}

interface AttendanceRow {
  id: string;
  scannedAt: string;
  method: string;
  participant: { firstName: string; lastName: string };
}

function SessionCard({
  eventId,
  session,
  windowMinutes,
  total,
}: {
  eventId: string;
  session: SessionRow;
  windowMinutes: number;
  total: number;
}) {
  const queryClient = useQueryClient();
  const attendances = useQuery({
    queryKey: ['attendances', session.id],
    queryFn: async (): Promise<{ data: AttendanceRow[] }> =>
      (await api.get(`/sessions/${session.id}/attendances`)).data,
  });

  async function toggleSelf(value: boolean): Promise<void> {
    try {
      await api.post(`/sessions/${session.id}/self-checkin/${value ? 'open' : 'close'}`);
      await queryClient.invalidateQueries({ queryKey: ['sessions', eventId] });
      toast.success(value ? 'Registro por QR abierto' : 'Registro por QR cerrado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  const start = new Date(session.startsAt).getTime();
  const windowMs = windowMinutes * 60_000;
  const end =
    (session.endsAt ? new Date(session.endsAt).getTime() : start + 4 * 3_600_000) + windowMs;
  const desde = new Date(start - windowMs);

  return (
    <Card>
      <p className="font-medium">
        {session.label ?? 'Sesión'} — {formatFechaHora(session.startsAt)}
      </p>
      <p className="text-sm text-[#5B6677]">
        Ventana: {formatFechaHora(desde.toISOString())} a{' '}
        {formatFechaHora(new Date(end).toISOString())}
        {session.location ? ` · ${session.location}` : ''}
      </p>
      <div className="mt-2">
        <Switch
          id={`self-${session.id}`}
          etiqueta={
            session.selfCheckinOpen
              ? 'Registro por QR de sala abierto'
              : 'Registro por QR de sala cerrado'
          }
          checked={session.selfCheckinOpen}
          onChange={(value) => void toggleSelf(value)}
        />
      </div>
      <div className="mt-2">
        <SessionScanActions sessionId={session.id} />
      </div>
      <p className="mt-2 text-sm">
        Presentes: <strong>{attendances.data?.data.length ?? 0}</strong> / {total}
      </p>
      {(attendances.data?.data.length ?? 0) > 0 ? (
        <ul className="mt-1 space-y-1 text-sm">
          {(attendances.data?.data ?? []).map((a) => (
            <li key={a.id}>
              {a.participant.firstName} {a.participant.lastName} — {formatFechaHora(a.scannedAt)} (
              {a.method})
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function AsistenciaTab({ eventId }: { eventId: string }) {
  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{ data: SessionRow[] }> =>
      (await api.get(`/sessions/event/${eventId}`)).data,
  });
  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<{ checkinWindowMinutes: number }> =>
      (await api.get(`/events/${eventId}`)).data,
  });
  const stats = useQuery({
    queryKey: ['stats', eventId],
    queryFn: async (): Promise<{ participants: number }> =>
      (await api.get(`/events/${eventId}/stats`)).data,
  });

  if (sessions.isLoading) return <p>Cargando sesiones…</p>;
  if (sessions.isError) return <p>No se pudieron cargar las sesiones.</p>;
  const list = sessions.data?.data ?? [];
  if (list.length === 0) {
    return <EmptyState mensaje="Aún no hay sesiones. Agréguelas en la pestaña Datos." />;
  }

  return (
    <div className="space-y-3">
      {list.map((s) => (
        <SessionCard
          key={s.id}
          eventId={eventId}
          session={s}
          windowMinutes={event.data?.checkinWindowMinutes ?? 60}
          total={stats.data?.participants ?? 0}
        />
      ))}
    </div>
  );
}
