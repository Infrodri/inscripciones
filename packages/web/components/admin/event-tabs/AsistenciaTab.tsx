'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Table';
import { Switch } from '@/components/ui/Switch';
import { ReporteAsistencia } from '@/components/admin/ReporteAsistencia';
import { SessionScanActions } from '@/components/admin/SessionScanActions';
import { QrProjection } from '@/components/admin/QrProjection';

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
      toast.success(value ? 'Registro por QR de sala abierto' : 'Registro por QR de sala cerrado');
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
    <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft space-y-4">
      <div className="border-b border-line pb-3">
        <h3 className="font-serif text-lg font-bold text-navy">
          {session.label ?? 'Sesión'} — {formatFechaHora(session.startsAt)}
        </h3>
        <p className="text-xs text-muted mt-1">
          Ventana de marcación: {formatFechaHora(desde.toISOString())} a{' '}
          {formatFechaHora(new Date(end).toISOString())}
          {session.location ? ` • Salón: ${session.location}` : ''}
        </p>
      </div>

      <div className="p-4 bg-canvas rounded-[var(--radius-md)] border border-line space-y-3">
        <Switch
          id={`self-${session.id}`}
          etiqueta={
            session.selfCheckinOpen
              ? 'Registro por QR de sala abierto (los asistentes pueden escanear)'
              : 'Registro por QR de sala cerrado'
          }
          checked={session.selfCheckinOpen}
          onChange={(value) => void toggleSelf(value)}
        />
        {session.selfCheckinOpen ? (
          <div className="pt-2">
            <QrProjection sessionId={session.id} />
          </div>
        ) : (
          <p className="text-sm text-muted">El registro por QR está cerrado.</p>
        )}
      </div>

      <div>
        <SessionScanActions sessionId={session.id} />
      </div>

      <div className="border-t border-line pt-3 flex items-center justify-between text-sm">
        <span className="text-muted">Asistentes confirmados:</span>
        <span className="font-semibold text-navy">
          {attendances.data?.data.length ?? 0} de {total} inscritos
        </span>
      </div>

      {(attendances.data?.data.length ?? 0) > 0 ? (
        <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-canvas p-2 text-xs max-h-48 overflow-y-auto">
          {(attendances.data?.data ?? []).map((a) => (
            <li key={a.id} className="py-1.5 px-2 flex justify-between items-center">
              <span className="font-medium text-ink">
                {a.participant.firstName} {a.participant.lastName}
              </span>
              <span className="text-muted">
                {formatFechaHora(a.scannedAt)} ({a.method})
              </span>
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

  if (sessions.isLoading) return <p className="text-muted">Cargando sesiones del evento…</p>;
  if (sessions.isError) return <p className="text-danger">No se pudieron cargar las sesiones.</p>;
  const list = sessions.data?.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState mensaje="Aún no hay sesiones configuradas. Agréguelas en la pestaña Datos." />
    );
  }

  return (
    <div className="space-y-4">
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

export function AsistenciaTabConReporte({ eventId, slug }: { eventId: string; slug: string }) {
  return (
    <div className="space-y-6">
      <AsistenciaTab eventId={eventId} />
      <ReporteAsistencia eventId={eventId} slug={slug} />
    </div>
  );
}
