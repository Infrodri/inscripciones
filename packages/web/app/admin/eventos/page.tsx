'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader } from '@/components/ui/Table';

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
      <ul className="mt-4 space-y-2">
        {data.data.map((e) => (
          <li key={e.id} className="rounded-[8px] border border-[#D9DEE7] bg-white p-3">
            <Link href={`/admin/eventos/${e.id}`} className="font-medium">
              {e.title}
            </Link>
            <p className="mt-1 text-sm text-[#5B6677]">
              {e.slug} — <Badge tono={e.status}>{e.status}</Badge>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
