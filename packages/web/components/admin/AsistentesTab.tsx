'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EnvioCorreoCard } from '@/components/admin/EnvioCorreoCard';
import { PdfPreviewDialog } from '@/components/admin/PdfPreviewDialog';

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
  minAttendancePercent?: number;
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
}

async function fetchPdfBlob(path: string): Promise<Blob> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'No se pudo exportar');
  }
  return res.blob();
}

async function fetchBlobUrl(path: string): Promise<string> {
  return URL.createObjectURL(await fetchPdfBlob(path));
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
  const [showPreview, setShowPreview] = useState(false);

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
      (await api.get(`/participants/event/${eventId}`, { params: { pageSize: 500 } })).data,
    enabled: scope === 'selected',
  });

  if (stats.isLoading) return <p className="text-sm text-muted">Cargando…</p>;
  if (stats.isError)
    return <p className="text-sm text-danger">No se pudo cargar: {apiErrorMessage(stats.error)}</p>;

  const total = stats.data?.participants ?? 0;
  const eligible = stats.data?.eligible ?? 0;
  const sessions = stats.data?.sessions ?? 0;
  const minPercent = stats.data?.minAttendancePercent ?? 80;
  const checkins = (stats.data?.perSession ?? []).reduce((a, s) => a + s.checkedIn, 0);
  // Sin control de asistencia (una sola sesión sin escaneos): "todos" primero.
  const effectiveScope: Scope = scope ?? (sessions <= 1 && checkins === 0 ? 'all' : 'eligible');
  const nonEligible = total - eligible;
  const defaultTemplate = templates.data?.data.find((t) => t.isDefault);

  async function download(filename: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading('Generando certificados en PDF…', { id: 'asistentes-pdf' });
    try {
      let url = `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=${effectiveScope}`;
      if (templateId) url += `&templateId=${templateId}`;
      if (effectiveScope === 'selected') {
        if (selected.length === 0) {
          toast.error('Seleccione al menos un inscrito', { id: toastId });
          setBusy(false);
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
      toast.success('PDF generado y descargado correctamente', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar', { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  function bulkUrl(): string {
    let url = `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=${effectiveScope}`;
    if (templateId) url += `&templateId=${templateId}`;
    if (effectiveScope === 'selected') url += `&ids=${selected.join(',')}`;
    return url;
  }

  function bulkTotal(): number {
    if (effectiveScope === 'eligible') return eligible;
    if (effectiveScope === 'selected') return selected.length;
    return total;
  }

  async function preview(): Promise<void> {
    if (effectiveScope === 'selected' && selected.length === 0) {
      toast.error('Seleccione al menos un inscrito');
      return;
    }
    setShowPreview(true);
  }

  if (templates.isSuccess && !defaultTemplate && !templateId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">Inscritos: {total}</span>
          <span className="text-muted">•</span>
          <span className="font-semibold text-ink">Aptos: {eligible}</span>
          <span className="text-xs text-muted">
            (Asistencia mínima requerida: {minPercent}% — {sessions}{' '}
            {sessions === 1 ? 'sesión' : 'sesiones'})
          </span>
        </div>
        <div className="rounded-lg border border-warn-border bg-warn-bg p-4 text-sm text-ink">
          <p className="font-medium text-warn">No hay plantilla predeterminada para ASISTENTE</p>
          <p className="mt-1 text-xs text-muted">
            Para generar y exportar certificados de asistentes, suba una plantilla y márquela como
            predeterminada en la pestaña Plantillas.
          </p>
          <div className="mt-3">
            <Button variant="secundario" onClick={onGoTemplates}>
              Ir a Plantillas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">Inscritos: {total}</span>
        <span className="text-muted">•</span>
        <span className="font-semibold text-ink">Aptos: {eligible}</span>
        <span className="text-xs text-muted">(Asistencia mínima requerida: {minPercent}%)</span>
      </div>
      {eligible === 0 && total > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          💡 Nota: Ningún inscrito cumple aún el {minPercent}% de asistencia requerido. Puede
          cambiar el alcance a &quot;Todos los inscritos&quot; para generar certificados sin validar
          asistencia.
        </p>
      )}
      <div className="mt-3 max-w-md">
        <Input
          id="tpl"
          etiqueta="Plantilla"
          desplegable
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Predeterminada del rol</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? ' (predeterminada)' : ''}
            </option>
          ))}
        </Input>
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
        <p className="mt-2 rounded-lg border border-warn-border bg-warn-bg p-3 text-xs text-ink">
          ⚠️ Advertencia: {nonEligible} inscrito(s) no cumplen la asistencia mínima ({minPercent}%)
          y también se incluirán en el PDF.
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
        <Button variant="secundario" onClick={() => void preview()}>
          Vista previa
        </Button>
        <Button onClick={() => void download('certificados-asistentes.pdf')} cargando={busy}>
          Descargar PDF
        </Button>
      </div>
      {showPreview ? (
        <PdfPreviewDialog
          titulo="Vista previa de certificados"
          totalPaginas={bulkTotal()}
          nombreArchivo="certificados-asistentes.pdf"
          onCargar={() => fetchPdfBlob(bulkUrl())}
          onCerrar={() => setShowPreview(false)}
        />
      ) : null}
      <div className="mt-4">
        <EnvioCorreoCard
          eventId={eventId}
          roleKind="ASISTENTE"
          contar={async () => {
            const res = (
              await api.get(`/participants/event/${eventId}`, {
                params: { stats: '1', pageSize: 500 },
              })
            ).data as {
              data: Array<{
                id: string;
                email: string | null;
                eligible?: boolean;
                certificateEmailedAt: string | null;
              }>;
            };
            let items = res.data;
            if (effectiveScope === 'eligible') items = items.filter((p) => p.eligible);
            if (effectiveScope === 'selected') items = items.filter((p) => selected.includes(p.id));
            return {
              enviar: items.filter((p) => p.email && !p.certificateEmailedAt).length,
              sinCorreo: items.filter((p) => !p.email).length,
              yaEnviados: items.filter((p) => p.certificateEmailedAt).length,
            };
          }}
        />
      </div>
      <p className="mt-2 text-sm">
        Siempre genere primero la vista previa de 1 página. Una página por persona, en orden de
        apellido, lista para imprimir seguido.
      </p>
    </div>
  );
}
