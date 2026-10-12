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
  speakerId: string | null;
  note: string | null;
  certificateCode: string | null;
}

interface Speaker {
  id: string;
  fullName: string;
  role: string;
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

export function ExpositoresTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [speakerId, setSpeakerId] = useState('');
  const [note, setNote] = useState('');

  const templates = useQuery({
    queryKey: ['templates-expositor', eventId],
    queryFn: async (): Promise<{ data: Template[] }> =>
      (
        await api.get(`/events/${eventId}/certificate-templates`, {
          params: { roleKind: 'EXPOSITOR' },
        })
      ).data,
  });
  const recipients = useQuery({
    queryKey: ['recipients-expositor', eventId],
    queryFn: async (): Promise<{ data: Recipient[] }> =>
      (
        await api.get(`/events/${eventId}/certificate-recipients`, {
          params: { roleKind: 'EXPOSITOR' },
        })
      ).data,
  });
  const speakers = useQuery({
    queryKey: ['speakers', eventId],
    queryFn: async (): Promise<{ data: Speaker[] }> =>
      (await api.get(`/speakers/event/${eventId}`)).data,
  });

  const defaultId = templates.data?.data.find((t) => t.isDefault)?.id ?? '';
  const effectiveTemplate = templateId !== '' ? templateId : defaultId;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await api.post(`/events/${eventId}/certificate-recipients`, {
        roleKind: 'EXPOSITOR',
        fullName,
        templateId: effectiveTemplate,
        speakerId: speakerId !== '' ? speakerId : null,
        note: note !== '' ? note : null,
      });
      setFullName('');
      setNote('');
      setSpeakerId('');
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      toast.success('Expositor agregado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function fromSpeakers(): Promise<void> {
    try {
      const res = await api.post(`/events/${eventId}/certificate-recipients/from-speakers`);
      const body = res.data as { created: unknown[]; skipped: string[] };
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      toast.success(`Creados ${body.created.length}, omitidos ${body.skipped.length}`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void fromSpeakers()}
        className="rounded border border-[#C9A227] px-3 py-1"
      >
        Cargar desde expositores del evento
      </button>
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid max-w-xl gap-2">
        <label className="text-sm">
          Nombre completo con título, tal como debe imprimirse
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="block w-full rounded border p-1"
            placeholder="Dr. César Suárez Saavedra"
          />
        </label>
        <label className="text-sm">
          Plantilla (solo EXPOSITOR)
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="block w-full rounded border p-1"
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
        <label className="text-sm">
          Vínculo a expositor (opcional)
          <select
            value={speakerId}
            onChange={(e) => setSpeakerId(e.target.value)}
            className="block w-full rounded border p-1"
          >
            <option value="">Sin vínculo</option>
            {(speakers.data?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.role})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Nota interna (no se imprime)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="block w-full rounded border p-1"
          />
        </label>
        <button type="submit" className="w-fit rounded bg-[#0A2A5E] px-4 py-1 text-white">
          Agregar expositor
        </button>
      </form>
      <ul className="mt-4 space-y-1">
        {(recipients.data?.data ?? []).map((r) => (
          <li key={r.id} className="text-sm">
            {r.fullName} — {r.certificateCode ? 'exportado' : 'pendiente'}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          void downloadPdf(
            `/events/${eventId}/exports/certificates.pdf?roleKind=EXPOSITOR&scope=all`,
            'certificados-expositores.pdf'
          )
        }
        className="mt-3 rounded bg-[#0A2A5E] px-3 py-1 text-white"
      >
        Exportar expositores
      </button>
    </div>
  );
}
