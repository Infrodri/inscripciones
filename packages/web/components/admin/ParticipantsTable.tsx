'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
  email: string;
  type: string;
  source: string;
}

async function download(
  kind: string,
  format: string,
  eventId: string,
  slug: string
): Promise<void> {
  const res = await fetch(apiUrl(`/events/${eventId}/exports/${kind}?format=${format}`), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    toast.error('No se pudo exportar');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-${slug}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(eventId: string, slug: string): Promise<void> {
  const res = await fetch(apiUrl(`/events/${eventId}/exports/attendance-list.pdf`), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    toast.error('No se pudo exportar');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-asistencia-${slug}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ParticipantsTable({ eventId, slug }: { eventId: string; slug: string }) {
  const [q, setQ] = useState('');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['participants', eventId, q],
    queryFn: async (): Promise<{ data: Participant[]; pagination: { total: number } }> =>
      (await api.get(`/participants/event/${eventId}`, { params: { q: q === '' ? undefined : q } }))
        .data,
  });

  if (isLoading) return <p>Cargando inscritos…</p>;
  if (isError) return <p>No se pudieron cargar los inscritos: {apiErrorMessage(error)}</p>;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-[#0A2A5E]">
          Inscritos ({data?.pagination.total ?? 0})
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void download('participants', 'xlsx', eventId, slug)}
            className="rounded border px-2 py-1"
          >
            XLSX
          </button>
          <button
            type="button"
            onClick={() => void download('participants', 'csv', eventId, slug)}
            className="rounded border px-2 py-1"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf(eventId, slug)}
            className="rounded border px-2 py-1"
          >
            Lista PDF
          </button>
        </div>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, CI o correo"
        className="mt-2 w-full rounded border p-2"
        aria-label="Buscar inscritos"
      />
      {(data?.data.length ?? 0) === 0 ? (
        <p className="mt-4">Aún no hay inscritos.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left">
                <th>Apellidos y nombres</th>
                <th>CI</th>
                <th>Correo</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td>
                    {p.lastName}, {p.firstName}
                  </td>
                  <td>{p.ci}</td>
                  <td>{p.email}</td>
                  <td>{p.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
