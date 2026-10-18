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
  note: string | null;
  certificateCode: string | null;
  email: string | null;
  certificateEmailedAt: string | null;
  certificateEmailError: string | null;
}

async function downloadPdf(url: string, filename: string): Promise<void> {
  const res = await fetch(apiUrl(url), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    if (res.status === 404) {
      toast.error('El servicio de credenciales devolvió 404. La API en Render todavía está desplegando la última versión.');
      return;
    }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    toast.error(body?.error?.message ?? `Error al generar el documento (HTTP ${res.status})`);
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
  const [email, setEmail] = useState('');
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
        email: email.trim() !== '' ? email : undefined,
        templateId: effectiveTemplate,
        note: cargo !== '' ? cargo : null,
      });
      setFullName('');
      setEmail('');
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
      <div className="max-w-md">
        <Input
          id="org-variante"
          etiqueta="Variante de plantilla (firma)"
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
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid max-w-xl gap-3">
        <Input
          id="org-nombre"
          etiqueta="Nombre con título/grado, tal como debe imprimirse"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Input
          id="org-cargo"
          etiqueta="Cargo (nota interna, no se imprime)"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
        />
        <Input
          id="org-correo"
          etiqueta="Correo"
          opcional=" (opcional, para envío)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Button type="submit">Agregar organizador</Button>
        </div>
      </form>
      <div className="mt-4 max-w-xl">
        <Input
          id="org-lista"
          etiqueta="Pegado de lista (un nombre por línea, misma variante)"
          multiline
          rows={4}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="mt-2">
          <Button variant="secundario" onClick={() => void submitPaste()}>
            Cargar lista
          </Button>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {(recipients.data?.data ?? []).map((r) => (
          <li key={r.id} className="text-sm">
            <span>
              {r.fullName}
              {r.note ? ` — ${r.note}` : ''} — {r.certificateCode ? 'exportado' : 'pendiente'}
            </span>{' '}
            <EstadoEnvio
              recipientId={r.id}
              email={r.email}
              emailedAt={r.certificateEmailedAt}
              error={r.certificateEmailError}
              queryKey={['recipients-organizador', eventId]}
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() =>
            void downloadPdf(
              `/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all`,
              'certificados-organizadores.pdf'
            )
          }
        >
          Exportar organizadores
        </Button>
        {(templates.data?.data ?? []).map((t) => (
          <Button
            key={t.id}
            variant="secundario"
            onClick={() =>
              void downloadPdf(
                `/events/${eventId}/exports/certificates.pdf?roleKind=ORGANIZADOR&scope=all&templateId=${t.id}`,
                `certificados-${t.name}.pdf`
              )
            }
          >
            Solo: {t.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
