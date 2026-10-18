'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { EstadoEnvio } from '@/components/admin/EstadoEnvio';
import { Edit2, Trash2, IdCard, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';

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
  role: 'EXPOSITOR' | 'MODERADOR' | string;
  titleProfession?: string | null;
  institution?: string | null;
}

const downloadingExpositorUrls = new Set<string>();

async function downloadPdf(url: string, filename: string): Promise<void> {
  if (downloadingExpositorUrls.has(url)) return;
  downloadingExpositorUrls.add(url);
  const toastId = toast.loading('Generando documento PDF…', { id: filename });
  try {
    const res = await fetch(apiUrl(url), {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) {
      if (res.status === 404) {
        toast.error('El servicio devolvió 404. La API en Render todavía está desplegando la última versión.', { id: toastId });
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      toast.error(body?.error?.message ?? `Error al generar el documento (HTTP ${res.status})`, { id: toastId });
      return;
    }
    const objectUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
    toast.success('PDF generado exitosamente', { id: toastId });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Error de conexión al generar PDF', { id: toastId });
  } finally {
    downloadingExpositorUrls.delete(url);
  }
}

export function ExpositoresTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [speakerId, setSpeakerId] = useState('');
  const [note, setNote] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

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
    try {
      await api.post(`/events/${eventId}/certificate-recipients`, {
        roleKind: 'EXPOSITOR',
        fullName: fullName.trim(),
        email: email.trim() !== '' ? email.trim() : undefined,
        templateId: effectiveTemplate || undefined,
        speakerId: speakerId !== '' ? speakerId : null,
        note: note !== '' ? note.trim() : null,
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
    setIsSyncing(true);
    try {
      const res = await api.post(`/events/${eventId}/certificate-recipients/from-speakers`);
      const body = res.data as { created: unknown[]; skipped: string[] };
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      await queryClient.invalidateQueries({ queryKey: ['templates-expositor', eventId] });
      toast.success(
        `Sincronización completa: ${body.created.length} nuevos habilitados para certificado`
      );
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSingleSpeakerSync(speaker: Speaker): Promise<void> {
    try {
      await api.post(`/events/${eventId}/certificate-recipients/from-speakers`);
      await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
      toast.success(`Certificado habilitado para ${speaker.fullName}`);
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
      toast.success('Expositor eliminado de la lista de certificados');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  const speakerList = speakers.data?.data ?? [];
  const recipientList = recipients.data?.data ?? [];

  // Mapear expositores del evento con sus certificados si ya fueron emitidos/vinculados
  const matchedRecipientIds = new Set<string>();

  const unifiedList = speakerList.map((sp) => {
    const matchedRecipient = recipientList.find(
      (r) =>
        r.speakerId === sp.id ||
        r.fullName.trim().toLowerCase() === sp.fullName.trim().toLowerCase()
    );
    if (matchedRecipient) {
      matchedRecipientIds.add(matchedRecipient.id);
    }
    return {
      speaker: sp,
      recipient: matchedRecipient ?? null,
    };
  });

  // Agregar destinatarios manuales que no tengan un speaker vinculado
  const unlinkedRecipients = recipientList.filter((r) => !matchedRecipientIds.has(r.id));

  const totalExpositores = unifiedList.length + unlinkedRecipients.length;

  return (
    <div className="space-y-6">
      {/* Botones de Acción Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 border border-line rounded-[var(--radius-md)] shadow-soft">
        <div>
          <h3 className="font-semibold text-ink text-sm">
            Expositores, Ponentes y Moderadores ({speakerList.length} registrados en el evento)
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Descargue credenciales oficiales o habilite sus diplomas y certificados académicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {speakerList.length > 0 && (
            <Button
              variant="secundario"
              onClick={() => void fromSpeakers()}
              disabled={isSyncing}
              title="Habilitar automáticamente a todos los expositores del evento para certificados"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando…' : 'Sincronizar a Certificados'}
            </Button>
          )}
        </div>
      </div>

      {/* Formulario para agregar expositor manual */}
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius-md)] border border-line bg-surface p-5 shadow-soft grid max-w-2xl gap-3"
      >
        <h4 className="font-semibold text-ink text-sm">Registrar expositor para emisión de certificados</h4>
        <Input
          id="exp-nombre"
          etiqueta="Nombre completo con título, tal como debe imprimirse"
          placeholder="Dr. César Suárez Saavedra"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
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
            {speakerList.map((s) => (
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

      {/* Lista de Expositores y Diplomas */}
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-5 shadow-soft space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h3 className="font-serif text-base font-semibold text-navy">
            Expositores y Ponentes del Evento
          </h3>
          <span className="text-xs text-muted">
            Total: <strong>{totalExpositores}</strong>
          </span>
        </div>

        <ul className="divide-y divide-line">
          {totalExpositores === 0 ? (
            <li className="text-xs text-muted italic py-6 text-center">
              No hay expositores ni ponentes registrados en este evento. Puede agregarlos en la pestaña &quot;Datos&quot; del evento o mediante el formulario de arriba.
            </li>
          ) : (
            <>
              {/* 1. Expositores vinculados del evento */}
              {unifiedList.map(({ speaker, recipient }) => (
                <li
                  key={speaker.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-canvas/30 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">{speaker.fullName}</span>
                      <Badge tono={speaker.role === 'EXPOSITOR' ? 'aviso' : 'neutro'}>
                        {speaker.role}
                      </Badge>
                      {recipient ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            recipient.certificateCode
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-canvas text-navy border border-line'
                          }`}
                        >
                          {recipient.certificateCode ? 'Diploma emitido' : 'Listo para diploma'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted italic">
                          (Pendiente de vincular a certificado)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-1">
                      {speaker.titleProfession && (
                        <span>• {speaker.titleProfession}</span>
                      )}
                      {speaker.institution && (
                        <span>• {speaker.institution}</span>
                      )}
                      {recipient?.email && <span>📧 {recipient.email}</span>}
                      {recipient?.note && <span className="italic">Nota: {recipient.note}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {recipient && (
                      <EstadoEnvio
                        recipientId={recipient.id}
                        email={recipient.email}
                        emailedAt={recipient.certificateEmailedAt}
                        error={recipient.certificateEmailError}
                        queryKey={['recipients-expositor', eventId]}
                      />
                    )}

                    {/* Botón de Credencial Oficial (siempre disponible para speakers) */}
                    <Button
                      variant="secundario"
                      size="sm"
                      onClick={() =>
                        void downloadPdf(
                          `/speakers/${speaker.id}/badge.pdf`,
                          `credencial-${speaker.fullName.replace(/\s+/g, '_')}.pdf`
                        )
                      }
                      title="Imprimir credencial individual"
                      className="text-xs"
                    >
                      <IdCard className="h-3.5 w-3.5 mr-1 text-gold" />
                      Credencial
                    </Button>

                    {!recipient ? (
                      <Button
                        variant="primario"
                        size="sm"
                        onClick={() => void handleSingleSpeakerSync(speaker)}
                        title="Habilitar emisión de certificado para este expositor"
                        className="text-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        Habilitar Certificado
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="fantasma"
                          size="sm"
                          onClick={() =>
                            setEditingRecipient({
                              id: recipient.id,
                              fullName: recipient.fullName,
                              email: recipient.email ?? '',
                              note: recipient.note ?? '',
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
                              id: recipient.id,
                              fullName: recipient.fullName,
                            })
                          }
                          title="Eliminar expositor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}

              {/* 2. Destinatarios manuales sin speaker vinculado */}
              {unlinkedRecipients.map((r) => (
                <li
                  key={r.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-canvas/30 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">{r.fullName}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.certificateCode
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-canvas text-navy border border-line'
                        }`}
                      >
                        {r.certificateCode ? 'Diploma emitido' : 'Listo para diploma'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-1">
                      {r.email && <span>📧 {r.email}</span>}
                      {r.note && <span className="italic">Nota: {r.note}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <EstadoEnvio
                      recipientId={r.id}
                      email={r.email}
                      emailedAt={r.certificateEmailedAt}
                      error={r.certificateEmailError}
                      queryKey={['recipients-expositor', eventId]}
                    />

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
                      title="Eliminar de certificados"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>

        {recipientList.length > 0 && (
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
              Exportar todos los certificados de expositores (PDF)
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

      {/* DIÁLOGO ÚNICO DE CONFIRMACIÓN DE ELIMINACIÓN */}
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
