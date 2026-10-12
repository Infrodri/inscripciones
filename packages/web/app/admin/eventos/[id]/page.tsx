'use client';

import { use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { EventCollections } from '@/components/admin/EventCollections';
import { ParticipantsTable } from '@/components/admin/ParticipantsTable';

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  location: string;
}

export default function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Detail params={params} />;
}

function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['event', id],
    queryFn: async (): Promise<EventDetail> => (await api.get(`/events/${id}`)).data,
  });

  async function publish(): Promise<void> {
    try {
      await api.post(`/events/${id}/publish`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Evento publicado');
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status !== 401)
        toast.error(apiErrorMessage(err));
    }
  }

  if (isLoading) return <p>Cargando evento…</p>;
  if (isError || !data)
    return <p>No se pudo cargar el evento: {isError ? apiErrorMessage(error) : ''}</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-[#0A2A5E]">{data.title}</h1>
        {data.status === 'BORRADOR' ? (
          <button
            type="button"
            onClick={() => void publish()}
            className="rounded bg-[#0A2A5E] px-4 py-2 text-white"
          >
            Publicar
          </button>
        ) : (
          <p className="text-sm">Estado: {data.status}</p>
        )}
      </div>
      <p className="mt-1 text-sm">
        {data.slug} — {data.location}
      </p>
      <p className="mt-2 text-sm">
        Página pública:{' '}
        <a href={`/e/${data.slug}`} className="underline">
          /e/{data.slug}
        </a>
      </p>
      <EventCollections eventId={id} />
      <ParticipantsTable eventId={id} slug={data.slug} />
    </div>
  );
}
