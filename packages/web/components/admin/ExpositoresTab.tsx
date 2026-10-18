'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EstadoEnvio } from '@/components/admin/EstadoEnvio';

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
  email: string | null;
  certificateEmailedAt: string | null;
  certificateEmailError: string | null;
}

interface Speaker {
  id: string;
  fullName: string;
  role: string;
}

async function downloadPdf(url: string, filename: string): Promise<void> {
  const res = await fetch(apiUrl(url), {
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
  const [email, setEmail] = useState('');
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
    if (!effectiveTemplate) {
      toast.error('Seleccione una plantilla o configure una predeterminada para EXPOSITOR');
      return;
    }
    try {
      await api.post(`/events/${eventId}/certificate-recipients`, {
        roleKind: 'EXPOSITOR',
        fullName,
        email: email.trim() !== '' ? email : undefined,
        templateId: effectiveTemplate,
        speakerId: speakerId !== '' ? speakerId : null,
        note: note !== '' ? note : null,
      });
      setFullName('');
      setEmail('');
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
    if (!defaultId) {
      toast.error(
        'No hay una plantilla predeterminada para EXPOSITOR. Configure una en la pestaña Plantillas antes de importar.'
      );
      return;
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          variant="secundario"
          onClick={() => void fromSpeakers()}
          disabled={!defaultId}
          title={!defaultId ? 'Configure una plantilla predeterminada para EXPOSITOR' : undefined}
        >
          Cargar desde expositores del evento
        </Button>
        {!defaultId && (
          <p className="text-xs text-muted">
            ⚠️ Para importar expositores automáticamente, configure primero una plantilla
            predeterminada en la pestaña <span className="font-medium text-ink">Plantillas</span>.
          </p>
        )}
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid max-w-xl gap-3">
        <Input
          id="exp-nombre"
          etiqueta="Nombre completo con título, tal como debe imprimirse"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Dr. César Suárez Saavedra"
        />
        <Input
          id="exp-plantilla"
          etiqueta="Plantilla (solo EXPOSITOR)"
          desplegable
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Predeterminada</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? ' (predeterminada)' : ''}
            </option>
          ))}
        </Input>
        <Input
          id="exp-speaker"
          etiqueta="Vínculo a expositor"
          opcional=" (opcional)"
          desplegable
          value={speakerId}
          onChange={(e) => setSpeakerId(e.target.value)}
        >
          <option value="">Sin vínculo</option>
          {(speakers.data?.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} ({s.role})
            </option>
          ))}
        </Input>
        <Input
          id="exp-correo"
          etiqueta="Correo"
          opcional=" (opcional, para envío)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="exp-nota"
          etiqueta="Nota interna (no se imprime)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div>
          <Button type="submit">Agregar expositor</Button>
        </div>
      </form>
      <ul className="mt-4 space-y-2">
        {(recipients.data?.data ?? []).map((r) => (
          <li key={r.id} className="text-sm">
            <span>
              {r.fullName} — {r.certificateCode ? 'exportado' : 'pendiente'}
            </span>{' '}
            <EstadoEnvio
              recipientId={r.id}
              email={r.email}
              emailedAt={r.certificateEmailedAt}
              error={r.certificateEmailError}
              queryKey={['recipients-expositor', eventId]}
            />
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button
          onClick={() =>
            void downloadPdf(
              `/events/${eventId}/exports/certificates.pdf?roleKind=EXPOSITOR&scope=all`,
              'certificados-expositores.pdf'
            )
          }
        >
          Exportar expositores
        </Button>
      </div>
    </div>
  );
}
