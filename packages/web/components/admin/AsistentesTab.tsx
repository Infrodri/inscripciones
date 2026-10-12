'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, getToken } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
}

async function downloadPdf(url: string, filename: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    toast.error(body?.error?.message ?? 'No se pudo exportar');
    return;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
  toast.success('PDF generado');
}

export function AsistentesTab({ eventId }: { eventId: string }) {
  const [templateId, setTemplateId] = useState('');
  const stats = useQuery({
    queryKey: ['stats', eventId],
    queryFn: async (): Promise<{ participants: number; eligible: number }> =>
      (await api.get(`/events/${eventId}/stats`)).data,
  });
  const templates = useQuery({
    queryKey: ['templates-asistente', eventId],
    queryFn: async (): Promise<{ data: Template[] }> =>
      (
        await api.get(`/events/${eventId}/certificate-templates`, {
          params: { roleKind: 'ASISTENTE' },
        })
      ).data,
  });

  if (stats.isLoading) return <p>Cargando…</p>;
  if (stats.isError) return <p>No se pudo cargar: {apiErrorMessage(stats.error)}</p>;

  return (
    <div>
      <p>
        Inscritos: <strong>{stats.data?.participants ?? 0}</strong> — Aptos:{' '}
        <strong>{stats.data?.eligible ?? 0}</strong>
      </p>
      <div className="mt-3">
        <label htmlFor="tpl">Plantilla</label>
        <select
          id="tpl"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="ml-2 rounded border p-1"
        >
          <option value="">Predeterminada del rol</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? ' (predeterminada)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void downloadPdf(
              `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=eligible${templateId ? `&templateId=${templateId}` : ''}`,
              'certificados-aptos.pdf'
            )
          }
          className="rounded bg-[#0A2A5E] px-3 py-1 text-white"
        >
          Exportar aptos
        </button>
        <button
          type="button"
          onClick={() =>
            void downloadPdf(
              `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=all${templateId ? `&templateId=${templateId}` : ''}`,
              'certificados-todos.pdf'
            )
          }
          className="rounded border px-3 py-1"
        >
          Exportar todos (advierte no aptos)
        </button>
      </div>
      <p className="mt-2 text-sm">
        Siempre genere primero la vista previa de 1 página desde la plantilla.
      </p>
    </div>
  );
}
