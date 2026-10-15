'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, getSessionUser } from '@/lib/api';
import { formatFecha } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Table';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface EventCardProps {
  event: EventRow;
  onDelete?: boolean;
}

function EventCard({ event, onDelete }: EventCardProps) {
  const queryClient = useQueryClient();
  const stats = useQuery({
    queryKey: ['stats', event.id],
    queryFn: async (): Promise<{ participants: number }> =>
      (await api.get(`/events/${event.id}/stats`)).data,
  });
  const sessions = useQuery({
    queryKey: ['sessions', event.id],
    queryFn: async (): Promise<{ data: Array<{ startsAt: string }> }> =>
      (await api.get(`/sessions/event/${event.id}`)).data,
  });
  const dates = (sessions.data?.data ?? []).map((s) => s.startsAt).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];

  async function duplicate(): Promise<void> {
    const title = window.prompt('Título del nuevo evento:', `${event.title} (copia)`);
    if (!title) return;
    const slug = window.prompt('Slug del nuevo evento:', `${event.slug}-copia`);
    if (!slug) return;
    try {
      const res = await api.post(`/events/${event.id}/duplicate`, { title, slug, daysShift: 1 });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento duplicado');
      window.location.href = `/admin/eventos/${(res.data as { id: string }).id}`;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!onDelete) return;
    const confirmed = window.confirm(`Eliminar "${event.title}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await api.delete(`/events/${event.id}`);
      toast.success('Evento eliminado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <Card className="bg-surface border-line shadow-soft rounded-[var(--radius-md)]">
      <p className="font-medium text-ink">
        <Link href={`/admin/eventos/${event.id}`} className="hover:underline text-navy-hover">
          {event.title}
        </Link>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Badge tono={event.status}>{event.status}</Badge>
        {first ? <span>desde {formatFecha(first)}</span> : <span>sin fecha</span>}
        {last && last !== first ? <span>hasta {formatFecha(last)}</span> : null}
        <span>Inscritos: {stats.data?.participants ?? '…'}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild variant="primario" size="sm">
          <Link href={`/admin/eventos/${event.id}`}>Abrir</Link>
        </Button>
        <Button variant="secundario" size="sm" onClick={() => void duplicate()}>
          Duplicar
        </Button>
        {onDelete && (
          <Button variant="peligro" size="sm" onClick={() => void handleDelete()}>
            Eliminar
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function EventosPage() {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === 'ADMIN';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: EventRow[] }> => (await api.get('/events')).data,
  });

  if (isLoading) return <p className="text-muted">Cargando eventos…</p>;
  if (isError) return <p className="text-danger">No se pudieron cargar los eventos: {apiErrorMessage(error)}</p>;
  if (!data || data.data.length === 0) {
    return (
      <div className="bg-surface rounded-[var(--radius-md)] border border-line p-6">
        <PageHeader titulo="Eventos" migas={[{ etiqueta: 'Eventos' }]} />
        <div className="mt-4">
          <EmptyState
            mensaje="Aún no hay eventos. Cree el primero."
            accion={
              <Button asChild>
                <Link href="/admin/eventos/nuevo">Nuevo evento</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-surface rounded-[var(--radius-md)] border border-line p-6">
      <PageHeader
        titulo="Eventos"
        accion={
          <Button asChild>
            <Link href="/admin/eventos/nuevo">Nuevo evento</Link>
          </Button>
        }
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.data.map((e) => (
          <EventCard key={e.id} event={e} onDelete={isAdmin ? true : undefined} />
        ))}
      </div>
    </div>
  );
}
