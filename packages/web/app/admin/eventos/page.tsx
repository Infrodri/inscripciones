'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
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

function EventCard({ event }: { event: EventRow }) {
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

  return (
    <Card>
      <p className="font-medium">
        <Link href={`/admin/eventos/${event.id}`} className="hover:underline">
          {event.title}
        </Link>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#5B6677]">
        <Badge tono={event.status}>{event.status}</Badge>
        {first ? <span>desde {formatFecha(first)}</span> : <span>sin fecha</span>}
        {last && last !== first ? <span>hasta {formatFecha(last)}</span> : null}
        <span>Inscritos: {stats.data?.participants ?? '…'}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={`/admin/eventos/${event.id}`}
          className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[#0A2A5E] px-3 py-1 text-sm text-white"
        >
          Abrir
        </Link>
        <Button variant="secundario" onClick={() => void duplicate()}>
          Duplicar
        </Button>
      </div>
    </Card>
  );
}

export default function EventosPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: EventRow[] }> => (await api.get('/events')).data,
  });

  if (isLoading) return <p>Cargando eventos…</p>;
  if (isError) return <p>No se pudieron cargar los eventos: {apiErrorMessage(error)}</p>;
  if (!data || data.data.length === 0) {
    return (
      <div>
        <PageHeader titulo="Eventos" />
        <div className="mt-4">
          <EmptyState
            mensaje="Aún no hay eventos. Cree el primero."
            accion={
              <Link
                href="/admin/eventos/nuevo"
                className="inline-block min-h-[44px] rounded-[8px] bg-[#0A2A5E] px-4 py-2 text-white"
              >
                Nuevo evento
              </Link>
            }
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        titulo="Eventos"
        accion={
          <Link
            href="/admin/eventos/nuevo"
            className="inline-block min-h-[44px] rounded-[8px] bg-[#0A2A5E] px-4 py-2 text-white"
          >
            Nuevo evento
          </Link>
        }
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.data.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}
