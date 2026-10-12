'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  status: string;
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
        <h1 className="font-serif text-2xl text-[#0A2A5E]">Eventos</h1>
        <p className="mt-4">Aún no hay eventos. Cree el primero.</p>
        <Link
          href="/admin/eventos/nuevo"
          className="mt-4 inline-block rounded bg-[#0A2A5E] px-4 py-2 text-white"
        >
          Nuevo evento
        </Link>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-[#0A2A5E]">Eventos</h1>
        <Link href="/admin/eventos/nuevo" className="rounded bg-[#0A2A5E] px-4 py-2 text-white">
          Nuevo evento
        </Link>
      </div>
      <ul className="mt-4 space-y-2">
        {data.data.map((e) => (
          <li key={e.id} className="rounded border p-3">
            <Link href={`/admin/eventos/${e.id}`} className="font-medium">
              {e.title}
            </Link>
            <p className="text-sm">
              {e.slug} — {e.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
