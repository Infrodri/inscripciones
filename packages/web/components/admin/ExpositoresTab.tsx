'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { EstadoEnvio } from '@/components/admin/EstadoEnvio';
import { Edit2, Trash2, IdCard } from 'lucide-react';

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
  toast.success('PDF generado exitosamente');
}

export function ExpositoresTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [speakerId, setSpeakerId] = useState('');
  const [note, setNote] = useState('');

  // Edit and Delete States
  const [editingRecipient, setEditingRecipient] = useState<{
    id: string;
    fullName: string;
    email: string;
    note: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    fullName: string;
  } | null>(null);

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
      toast.success('Expositor agregado para certificado');
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

  async function handleUpdateRecipient(): Promise<void> {
    if (!editingRecipient) return;
    if (!editingRecipient.fullName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    try {
      await api.put(`/certificate-recipients/${editingRecipient.id}`, {
        fullName: editingRecipient.fullName.trim(),
        email: editingRecipient.email.trim() || null,
        note: editingRecipient.note.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      setEditingRecipient(null);
      toast.success('Expositor actualizado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleDeleteRecipient(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await api.delete(`/certificate-recipients/${deleteTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      setDeleteTarget(null);
      toast.success('Expositor eliminado de la lista');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
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

      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-xl border border-line bg-surface p-5 shadow-soft grid max-w-2xl gap-3"
      >
        <h3 className="font-serif text-base font-semibold text-navy">
          Registrar expositor para emisión de certificados
        </h3>
        <Input
          id="exp-nombre"
          etiqueta="Nombre completo con título, tal como debe imprimirse"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Dr. César Suárez Saavedra"
        />
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="exp-correo"
            etiqueta="Correo electrónico"
            opcional=" (opcional, para envío)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="exp-nota"
            etiqueta="Nota interna (no se imprime)"
            opcional=" (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="primario" type="submit">
            Agregar expositor
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-line bg-surface p-5 shadow-soft space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h3 className="font-serif text-base font-semibold text-navy">
            Expositores registrados para certificados
          </h3>
          <span className="text-xs text-muted font-medium">
            Total: {(recipients.data?.data ?? []).length}
          </span>
        </div>

        <ul className="divide-y divide-line/60">
          {(recipients.data?.data ?? []).length === 0 ? (
            <li className="text-xs text-muted italic py-4 text-center">
              No hay expositores registrados para certificados en este evento.
            </li>
          ) : (
            (recipients.data?.data ?? []).map((r) => (
              <li
                key={r.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-navy">{r.fullName}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.certificateCode ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                      }`}
                    >
                      {r.certificateCode ? 'Exportado' : 'Pendiente'}
                    </span>
                    {r.email && <span>📧 {r.email}</span>}
                    {r.note && <span className="italic">Nota: {r.note}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <EstadoEnvio
                    recipientId={r.id}
                    email={r.email}
                    emailedAt={r.certificateEmailedAt}
                    error={r.certificateEmailError}
                    queryKey={['recipients-expositor', eventId]}
                  />

                  {r.speakerId && (
                    <Button
                      variant="secundario"
                      size="sm"
                      onClick={() =>
                        void downloadPdf(
                          `/speakers/${r.speakerId}/badge.pdf`,
                          `credencial-${r.fullName.replace(/\s+/g, '_')}.pdf`
                        )
                      }
                      title="Imprimir credencial individual"
                      className="text-xs"
                    >
                      <IdCard className="h-3.5 w-3.5 mr-1 text-gold" />
                      Credencial
                    </Button>
                  )}

                  <Button
                    variant="fantasma"
                    size="sm"
                    onClick={() =>
                      setEditingRecipient({
                        id: r.id,
                        fullName: r.fullName,
                        email: r.email ?? '',
                        note: r.note ?? '',
                      })
                    }
                    title="Editar datos del expositor"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>

                  <Button
                    variant="peligro"
                    size="sm"
                    onClick={() =>
                      setDeleteTarget({
                        id: r.id,
                        fullName: r.fullName,
                      })
                    }
                    title="Eliminar expositor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>

        {(recipients.data?.data ?? []).length > 0 && (
          <div className="pt-3 border-t border-line flex justify-end">
            <Button
              variant="primario"
              onClick={() =>
                void downloadPdf(
                  `/events/${eventId}/exports/certificates.pdf?roleKind=EXPOSITOR&scope=all`,
                  'certificados-expositores.pdf'
                )
              }
            >
              Exportar todos los certificados (PDF)
            </Button>
          </div>
        )}
      </div>

      {/* DIÁLOGO DE EDICIÓN DE RECEPTOR */}
      {editingRecipient && (
        <Dialog
          open={true}
          titulo="Editar datos de expositor"
          onCerrar={() => setEditingRecipient(null)}
          accion={
            <Button variant="primario" onClick={() => void handleUpdateRecipient()}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="edit-recip-nombre"
              etiqueta="Nombre completo tal como se imprimirá en el certificado"
              value={editingRecipient.fullName}
              onChange={(e) =>
                setEditingRecipient((prev) =>
                  prev ? { ...prev, fullName: e.target.value } : null
                )
              }
              required
            />
            <Input
              id="edit-recip-correo"
              etiqueta="Correo electrónico"
              opcional=" (opcional)"
              type="email"
              value={editingRecipient.email}
              onChange={(e) =>
                setEditingRecipient((prev) => (prev ? { ...prev, email: e.target.value } : null))
              }
            />
            <Input
              id="edit-recip-nota"
              etiqueta="Nota interna"
              opcional=" (opcional)"
              value={editingRecipient.note}
              onChange={(e) =>
                setEditingRecipient((prev) => (prev ? { ...prev, note: e.target.value } : null))
              }
            />
          </div>
        </Dialog>
      )}

      {/* DIÁLOGO ÚNICO DE CONFIRMACIÓN DE ELIMINACIÓN (Anti-Regression Rule 2) */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          titulo="¿Eliminar expositor de certificados?"
          mensaje={
            <p className="text-sm text-ink">
              ¿Está seguro de eliminar a <strong>{deleteTarget.fullName}</strong> de la lista de
              certificados? Esta acción no se puede deshacer.
            </p>
          }
          confirmar="Eliminar"
          onConfirmar={() => void handleDeleteRecipient()}
          onCerrar={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
