'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
}

interface Stats {
  participants: number;
  eligible: number;
  sessions: number;
  perSession: Array<{ checkedIn: number }>;
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
}

async function fetchBlobUrl(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'No se pudo exportar');
  }
  return URL.createObjectURL(await res.blob());
}

type Scope = 'all' | 'eligible' | 'selected';

export function AsistentesTab({
  eventId,
  onGoTemplates,
}: {
  eventId: string;
  onGoTemplates: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [scope, setScope] = useState<Scope | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const stats = useQuery({
    queryKey: ['stats', eventId],
    queryFn: async (): Promise<Stats> => (await api.get(`/events/${eventId}/stats`)).data,
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
  const participants = useQuery({
    queryKey: ['participants-list', eventId],
    queryFn: async (): Promise<{ data: Participant[] }> =>
      (await api.get(`/participants/event/${eventId}`, { params: { pageSize: 100 } })).data,
    enabled: scope === 'selected',
  });

  if (stats.isLoading) return <p>Cargando…</p>;
  if (stats.isError) return <p>No se pudo cargar: {apiErrorMessage(stats.error)}</p>;

  const total = stats.data?.participants ?? 0;
  const eligible = stats.data?.eligible ?? 0;
  const sessions = stats.data?.sessions ?? 0;
  const checkins = (stats.data?.perSession ?? []).reduce((a, s) => a + s.checkedIn, 0);
  // Sin control de asistencia (una sola sesión sin escaneos): "todos" primero.
  const effectiveScope: Scope = scope ?? (sessions <= 1 && checkins === 0 ? 'all' : 'eligible');
  const nonEligible = total - eligible;
  const defaultTemplate = templates.data?.data.find((t) => t.isDefault);

  async function download(filename: string): Promise<void> {
    setBusy(true);
    try {
      let url = `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=${effectiveScope}`;
      if (templateId) url += `&templateId=${templateId}`;
      if (effectiveScope === 'selected') {
        if (selected.length === 0) {
          toast.error('Seleccione al menos un inscrito');
          return;
        }
        url += `&ids=${selected.join(',')}`;
      }
      const objectUrl = await fetchBlobUrl(url);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success('PDF generado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar');
    } finally {
      setBusy(false);
    }
  }

  async function preview(): Promise<void> {
    const tpl = templateId || defaultTemplate?.id;
    if (!tpl) {
      toast.error('No hay plantilla predeterminada para ASISTENTE');
      return;
    }
    try {
      const objectUrl = await fetchBlobUrl(
        `/certificate-templates/${tpl}/preview.pdf?sampleName=${encodeURIComponent('Nombre de muestra')}`
      );
      window.open(objectUrl, '_blank');
    } catch {
      toast.error('No se pudo generar la vista previa');
    }
  }

  if (templates.isSuccess && !defaultTemplate && !templateId) {
    return (
      <div>
        <p>
          Inscritos: <strong>{total}</strong> — Aptos: <strong>{eligible}</strong>
        </p>
        <p className="mt-3 rounded border border-[#C9A227] p-3 text-sm">
          No hay plantilla predeterminada para ASISTENTE. Súbala y márquela como predeterminada en
          la pestaña Plantillas.
        </p>
        <button
          type="button"
          onClick={onGoTemplates}
          className="mt-2 min-h-[44px] rounded border px-3 py-2"
        >
          Ir a Plantillas
        </button>
      </div>
    );
  }

  return (
    <div>
      <p>
        Inscritos: <strong>{total}</strong> — Aptos: <strong>{eligible}</strong>
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
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">Alcance</legend>
        {(
          [
            ['all', 'Todos los inscritos'],
            ['eligible', 'Solo aptos'],
            ['selected', 'Seleccionados'],
          ] as Array<[Scope, string]>
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope"
              checked={effectiveScope === value}
              onChange={() => setScope(value)}
              className="h-5 w-5"
            />
            {label}
          </label>
        ))}
      </fieldset>
      {effectiveScope === 'all' && nonEligible > 0 ? (
        <p className="mt-2 rounded border border-[#C9A227] p-2 text-sm">
          Advertencia: {nonEligible} inscrito(s) no están aptos y también saldrán en el PDF.
        </p>
      ) : null}
      {effectiveScope === 'selected' ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border p-2">
          {(participants.data?.data ?? []).map((p) => (
            <li key={p.id}>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id)
                    )
                  }
                  className="h-5 w-5"
                />
                {p.lastName}, {p.firstName}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void preview()}
          className="min-h-[44px] rounded border px-3 py-2"
        >
          Vista previa
        </button>
        <button
          type="button"
          onClick={() => void download('certificados-asistentes.pdf')}
          disabled={busy}
          className="min-h-[44px] rounded bg-[#0A2A5E] px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>
      <p className="mt-2 text-sm">
        Siempre genere primero la vista previa de 1 página. Una página por persona, en orden de
        apellido, lista para imprimir seguido.
      </p>
    </div>
  );
}
