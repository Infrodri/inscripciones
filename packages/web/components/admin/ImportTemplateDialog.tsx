'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface SharedTemplate {
  id: string;
  name: string;
  roleKind: string;
  filePath: string;
  event: { id: string; title: string; slug: string };
}

function TemplateThumb({ templateId, name }: { templateId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetch(apiUrl(`/certificate-templates/${templateId}/file`), {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        objectUrl = URL.createObjectURL(await res.blob());
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [templateId]);
  if (!url) return <p className="text-sm text-[#5B6677]">Cargando miniatura…</p>;
  return <img src={url} alt={`Miniatura de ${name}`} className="max-h-32 rounded border" />;
}

export function ImportTemplateDialog({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sourceEvent, setSourceEvent] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['shared-templates'],
    queryFn: async (): Promise<{ data: SharedTemplate[] }> =>
      (await api.get('/certificate-templates/shared')).data,
  });
  const events = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: Array<{ id: string; title: string }> }> =>
      (await api.get('/events')).data,
  });

  async function importTemplate(sourceTemplateId: string): Promise<void> {
    try {
      await api.post(`/events/${eventId}/certificate-templates/import`, { sourceTemplateId });
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      toast.success('Plantilla importada como copia independiente');
      onClose();
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  const shared = (data?.data ?? []).filter((t) => t.event.id !== eventId);
  const visible = sourceEvent ? shared.filter((t) => t.event.id === sourceEvent) : shared;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Importar de otro evento"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-[8px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl text-[#0A2A5E]">Importar de otro evento</h2>
        <p className="mt-1 text-sm text-[#5B6677]">
          Solo plantillas marcadas como compartidas. Se crea una copia independiente.
        </p>
        {isLoading ? (
          <p className="mt-3">Cargando…</p>
        ) : (
          <>
            <label className="mt-3 block text-sm">
              Evento origen
              <select
                value={sourceEvent}
                onChange={(e) => setSourceEvent(e.target.value)}
                className="mt-1 block w-full rounded-[8px] border border-[#D9DEE7] p-2"
              >
                <option value="">Todos</option>
                {(events.data?.data ?? [])
                  .filter((e) => e.id !== eventId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
            {visible.length === 0 ? (
              <p className="mt-3 text-sm">No hay plantillas compartidas disponibles.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {visible.map((t) => (
                  <li key={t.id} className="rounded-[8px] border border-[#D9DEE7] p-2">
                    <p className="text-sm font-medium">
                      {t.name} ({t.roleKind})
                    </p>
                    <p className="text-sm text-[#5B6677]">{t.event.title}</p>
                    <TemplateThumb templateId={t.id} name={t.name} />
                    <div className="mt-2">
                      <Button variant="secundario" onClick={() => void importTemplate(t.id)}>
                        Importar copia
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="secundario" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
