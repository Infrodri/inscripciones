'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, getToken } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
}

interface Recipient {
  id: string;
  fullName: string;
  templateId: string;
  note: string | null;
  certificateCode: string | null;
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
  const objectUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
  toast.success('PDF generado');
}

export function OrganizadoresTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [cargo, setCargo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [paste, setPaste] = useState('');

  const templates = useQuery({
    queryKey: ['templates-organizador', eventId],
    queryFn: async (): Promise<{ data: Template[] }> =>
      (
        await api.get(`/events/${eventId}/certificate-templates`, {
          params: { roleKind: 'ORGANIZADOR' },
        })
      ).data,
  });
  const recipients = useQuery({
    queryKey: ['recipients-organizador', eventId],
    queryFn: async (): Promise<{ data: Recipient[] }> =>
      (
        await api.get(`/events/${eventId}/certificate-recipients`, {
          params: { roleKind: 'ORGANIZADOR' },
        })
      ).data,
  });

  const defaultId = templates.data?.data.find((t) => t.isDefault)?.id ?? '';
  const effectiveTemplate = templateId !== '' ? templateId : defaultId;

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['recipients-organizador', eventId] });
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await api.post(`/events/${eventId}/certificate-recipients`, {
        roleKind: 'ORGANIZADOR',
        fullName,
        templateId: effectiveTemplate,
        note: cargo !== '' ? cargo : null,
      });
      setFullName('');
      setCargo('');
      await refresh();
      toast.success('Organizador agregado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function submitPaste(): Promise<void> {
    const items = paste
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((fullName) => ({ fullName }));
    if (items.length === 0) return;
    try {
      const res = await api.post(`/events/${eventId}/certificate-recipients/bulk`, {
        roleKind: 'ORGANIZADOR',
        templateId: effectiveTemplate,
        items,
      });
      const body = res.data as { created: unknown[]; duplicates: string[] };
      setPaste('');
      await refresh();
      toast.success(`Creados ${body.created.length}, duplicados ${body.duplicates.length}`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div>
      <label className="text-sm">
        Variante de plantilla (firma)
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="ml-2 rounded border p-1"
        >
          <option value="">Predeterminada</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? ' (predeterminada)' : ''}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid max-w-xl gap-2">
        <label className="text-sm">
          Nombre con título/grado, tal como debe imprimirse
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="block w-full rounded border p-1"
          />
        </label>
        <label className="text-sm">
          Cargo (nota interna, no se imprime)
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="block w-full rounded border p-1"
          />
        </label>
        <button type="submit" className="w-fit rounded bg-[#0A2A5E] px-4 py-1 text-white">
          Agregar organizador
        </button>
      </form>
      <div className="mt-4 max-w-xl">
        <label className="text-sm">
          Pegado de lista (un nombre por línea, misma variante)
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            className="block w-full rounded border p-1"
          />
        </label>
        <button
          type="button"
          onClick={() => void submitPaste()}
          className="mt-2 rounded border px-3 py-1"
        >
          Cargar lista
        </button>
      </div>
      <ul className="mt-4 space-y-1">
        {(recipients.data?.data ?? []).map((r) => (
          <li key={r.id} className="text-sm">
            {r.fullName}
            {r.note ? ` — ${r.note}` : ''} — {r.certificateCode ? 'exportado' : 'pendiente'}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void downloadPdf(
              `/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all`,
              'certificados-organizadores.pdf'
            )
          }
          className="rounded bg-[#0A2A5E] px-3 py-1 text-white"
        >
          Exportar organizadores
        </button>
        {(templates.data?.data ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              void downloadPdf(
                `/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all&templateId=${t.id}`,
                `certificados-${t.name}.pdf`
              )
            }
            className="rounded border px-3 py-1"
          >
            Solo: {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
