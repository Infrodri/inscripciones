'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { SessionScanActions } from '@/components/admin/SessionScanActions';
import { Download, Edit2, Trash2, IdCard } from 'lucide-react';

interface SessionItem {
  id: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  label?: string | null;
}

interface SpeakerItem {
  id: string;
  fullName: string;
  role: 'EXPOSITOR' | 'MODERADOR';
  titleProfession?: string | null;
  institution?: string | null;
}

interface SponsorItem {
  id: string;
  name: string;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventCollections({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();

  // Add Dialog State
  const [addDialog, setAddDialog] = useState<'session' | 'speaker' | 'sponsor' | null>(null);
  const [sessionAt, setSessionAt] = useState('');
  const [sessionEndsAt, setSessionEndsAt] = useState('');
  const [sessionLocation, setSessionLocation] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [speakerRole, setSpeakerRole] = useState<'EXPOSITOR' | 'MODERADOR'>('EXPOSITOR');
  const [speakerTitle, setSpeakerTitle] = useState('');
  const [speakerInstitution, setSpeakerInstitution] = useState('');
  const [sponsorName, setSponsorName] = useState('');

  // Edit Dialog State
  const [editingSession, setEditingSession] = useState<{
    id: string;
    startsAt: string;
    endsAt: string;
    location: string;
    label: string;
  } | null>(null);

  const [editingSpeaker, setEditingSpeaker] = useState<{
    id: string;
    fullName: string;
    role: 'EXPOSITOR' | 'MODERADOR';
    titleProfession: string;
    institution: string;
  } | null>(null);

  const [editingSponsor, setEditingSponsor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Single Delete Target State for Root ConfirmDialog (Anti-Regression Rule 2)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'session' | 'speaker' | 'sponsor';
    id: string;
    name: string;
  } | null>(null);

  const [downloading, setDownloading] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{ data: SessionItem[] }> =>
      (await api.get(`/sessions/event/${eventId}`)).data,
  });

  const speakers = useQuery({
    queryKey: ['speakers', eventId],
    queryFn: async (): Promise<{ data: SpeakerItem[] }> =>
      (await api.get(`/speakers/event/${eventId}`)).data,
  });

  const sponsors = useQuery({
    queryKey: ['sponsors', eventId],
    queryFn: async (): Promise<{ data: SponsorItem[] }> =>
      (await api.get(`/sponsors/event/${eventId}`)).data,
  });

  async function downloadPdf(url: string, filename: string, key = filename): Promise<void> {
    setDownloading(key);
    try {
      const res = await fetch(apiUrl(url), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'No se pudo descargar el documento');
      }
      const objectUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success('Credencial descargada correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : apiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  // Session Handlers
  async function handleAddSession(): Promise<void> {
    if (!sessionAt) {
      toast.error('La fecha y hora de inicio son obligatorias');
      return;
    }
    if (sessionEndsAt && new Date(sessionEndsAt) <= new Date(sessionAt)) {
      toast.error('La hora de fin debe ser posterior al inicio');
      return;
    }
    try {
      await api.post('/sessions', {
        eventId,
        startsAt: new Date(sessionAt).toISOString(),
        endsAt: sessionEndsAt ? new Date(sessionEndsAt).toISOString() : null,
        location: sessionLocation.trim() || null,
        label: sessionLabel.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['sessions', eventId] });
      setAddDialog(null);
      setSessionAt('');
      setSessionEndsAt('');
      setSessionLocation('');
      setSessionLabel('');
      toast.success('Sesión / sala agregada');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function handleUpdateSession(): Promise<void> {
    if (!editingSession) return;
    if (!editingSession.startsAt) {
      toast.error('La fecha y hora de inicio son obligatorias');
      return;
    }
    if (editingSession.endsAt && new Date(editingSession.endsAt) <= new Date(editingSession.startsAt)) {
      toast.error('La hora de fin debe ser posterior al inicio');
      return;
    }
    try {
      await api.put(`/sessions/${editingSession.id}`, {
        startsAt: new Date(editingSession.startsAt).toISOString(),
        endsAt: editingSession.endsAt ? new Date(editingSession.endsAt).toISOString() : null,
        location: editingSession.location.trim() || null,
        label: editingSession.label.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['sessions', eventId] });
      setEditingSession(null);
      toast.success('Sesión actualizada');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  // Speaker Handlers
  async function handleAddSpeaker(): Promise<void> {
    if (!speakerName.trim()) {
      toast.error('El nombre del expositor es obligatorio');
      return;
    }
    try {
      await api.post('/speakers', {
        eventId,
        fullName: speakerName.trim(),
        role: speakerRole,
        titleProfession: speakerTitle.trim() || null,
        institution: speakerInstitution.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['speakers', eventId] });
      setAddDialog(null);
      setSpeakerName('');
      setSpeakerRole('EXPOSITOR');
      setSpeakerTitle('');
      setSpeakerInstitution('');
      toast.success('Expositor agregado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleUpdateSpeaker(): Promise<void> {
    if (!editingSpeaker) return;
    if (!editingSpeaker.fullName.trim()) {
      toast.error('El nombre del expositor es obligatorio');
      return;
    }
    try {
      await api.put(`/speakers/${editingSpeaker.id}`, {
        fullName: editingSpeaker.fullName.trim(),
        role: editingSpeaker.role,
        titleProfession: editingSpeaker.titleProfession.trim() || null,
        institution: editingSpeaker.institution.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['speakers', eventId] });
      setEditingSpeaker(null);
      toast.success('Expositor actualizado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  // Sponsor Handlers
  async function handleAddSponsor(): Promise<void> {
    if (!sponsorName.trim()) {
      toast.error('El nombre del auspiciante es obligatorio');
      return;
    }
    try {
      await api.post('/sponsors', {
        eventId,
        name: sponsorName.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['sponsors', eventId] });
      setAddDialog(null);
      setSponsorName('');
      toast.success('Auspiciante agregado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleUpdateSponsor(): Promise<void> {
    if (!editingSponsor) return;
    if (!editingSponsor.name.trim()) {
      toast.error('El nombre del auspiciante es obligatorio');
      return;
    }
    try {
      await api.put(`/sponsors/${editingSponsor.id}`, {
        name: editingSponsor.name.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['sponsors', eventId] });
      setEditingSponsor(null);
      toast.success('Auspiciante actualizado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  // Confirm Delete Handler
  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'session') {
        await api.delete(`/sessions/${deleteTarget.id}`);
        await queryClient.invalidateQueries({ queryKey: ['sessions', eventId] });
        toast.success('Sesión eliminada');
      } else if (deleteTarget.type === 'speaker') {
        await api.delete(`/speakers/${deleteTarget.id}`);
        await queryClient.invalidateQueries({ queryKey: ['speakers', eventId] });
        toast.success('Expositor eliminado');
      } else if (deleteTarget.type === 'sponsor') {
        await api.delete(`/sponsors/${deleteTarget.id}`);
        await queryClient.invalidateQueries({ queryKey: ['sponsors', eventId] });
        toast.success('Auspiciante eliminado');
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  const sessionList = sessions.data?.data ?? [];
  const speakerList = speakers.data?.data ?? [];
  const sponsorList = sponsors.data?.data ?? [];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      {/* 1. SECCIÓN SESIONES / SALAS / MESAS */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-soft flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-navy">Sesiones / Salas / Mesas</h2>
              <p className="text-xs text-muted mt-0.5">Gestión de horarios, salones y mesas de trabajo</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-line text-ink">
              {sessionList.length}
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {sessionList.length === 0 ? (
              <li className="text-xs text-muted italic p-3 text-center bg-canvas rounded-lg border border-dashed border-line">
                No hay sesiones o salas configuradas
              </li>
            ) : (
              sessionList.map((s) => (
                <li
                  key={s.id}
                  className="text-sm rounded-[var(--radius-md)] border border-line bg-canvas p-3 space-y-2.5 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy leading-snug">
                        {s.label ? s.label : 'Sesión'}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {formatFechaHora(s.startsAt)}
                        {s.endsAt ? ` · Fin: ${formatFechaHora(s.endsAt)}` : ''}
                      </div>
                      {s.location && (
                        <div className="text-xs text-ink font-medium mt-1">
                          📍 Salón/Mesa: {s.location}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex flex-wrap items-center justify-between gap-2">
                    <SessionScanActions sessionId={s.id} />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="fantasma"
                        size="sm"
                        onClick={() =>
                          setEditingSession({
                            id: s.id,
                            startsAt: toLocalInput(s.startsAt),
                            endsAt: toLocalInput(s.endsAt),
                            location: s.location ?? '',
                            label: s.label ?? '',
                          })
                        }
                        title="Editar sesión"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="peligro"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'session',
                            id: s.id,
                            name: s.label || `Sesión ${formatFechaHora(s.startsAt)}`,
                          })
                        }
                        title="Eliminar sesión"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="mt-4 pt-3 border-t border-line">
          <Button
            variant="secundario"
            className="w-full justify-center"
            onClick={() => {
              setSessionAt('');
              setSessionEndsAt('');
              setSessionLocation('');
              setSessionLabel('');
              setAddDialog('session');
            }}
          >
            + Agregar sesión / sala
          </Button>
        </div>
      </section>

      {/* 2. SECCIÓN EXPOSITORES */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-soft flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-navy">Expositores y Ponentes</h2>
              <p className="text-xs text-muted mt-0.5">Disertantes, moderadores y panelistas</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-line text-ink">
              {speakerList.length}
            </span>
          </div>

          {speakerList.length > 0 && (
            <div className="mt-3">
              <Button
                variant="secundario"
                size="sm"
                className="w-full text-xs"
                cargando={downloading === 'all-speakers'}
                onClick={() =>
                  void downloadPdf(
                    `/events/${eventId}/exports/speakers-badges.pdf`,
                    `credenciales-expositores.pdf`,
                    'all-speakers'
                  )
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Descargar todas las credenciales (A4)
              </Button>
            </div>
          )}

          <ul className="mt-3 space-y-2.5">
            {speakerList.length === 0 ? (
              <li className="text-xs text-muted italic p-3 text-center bg-canvas rounded-lg border border-dashed border-line">
                No hay expositores registrados
              </li>
            ) : (
              speakerList.map((s) => (
                <li
                  key={s.id}
                  className="text-sm rounded-[var(--radius-md)] border border-line bg-canvas p-3 space-y-2 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy leading-snug">{s.fullName}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {s.role}
                        </span>
                        {s.titleProfession && (
                          <span className="text-ink">· {s.titleProfession}</span>
                        )}
                        {s.institution && (
                          <span className="text-muted">({s.institution})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                    <Button
                      variant="secundario"
                      size="sm"
                      cargando={downloading === `speaker-${s.id}`}
                      onClick={() =>
                        void downloadPdf(
                          `/speakers/${s.id}/badge.pdf`,
                          `credencial-${s.fullName.replace(/\s+/g, '_')}.pdf`,
                          `speaker-${s.id}`
                        )
                      }
                      title="Imprimir credencial individual"
                      className="text-xs font-semibold"
                    >
                      <IdCard className="mr-1 h-3.5 w-3.5 text-gold" />
                      Credencial
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="fantasma"
                        size="sm"
                        onClick={() =>
                          setEditingSpeaker({
                            id: s.id,
                            fullName: s.fullName,
                            role: s.role,
                            titleProfession: s.titleProfession ?? '',
                            institution: s.institution ?? '',
                          })
                        }
                        title="Editar expositor"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="peligro"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'speaker',
                            id: s.id,
                            name: s.fullName,
                          })
                        }
                        title="Eliminar expositor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="mt-4 pt-3 border-t border-line">
          <Button
            variant="secundario"
            className="w-full justify-center"
            onClick={() => {
              setSpeakerName('');
              setSpeakerRole('EXPOSITOR');
              setSpeakerTitle('');
              setSpeakerInstitution('');
              setAddDialog('speaker');
            }}
          >
            + Agregar expositor
          </Button>
        </div>
      </section>

      {/* 3. SECCIÓN AUSPICIANTES */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-soft flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-navy">Auspiciantes y Patrocinadores</h2>
              <p className="text-xs text-muted mt-0.5">Empresas, instituciones y aliados</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-line text-ink">
              {sponsorList.length}
            </span>
          </div>

          {sponsorList.length > 0 && (
            <div className="mt-3">
              <Button
                variant="secundario"
                size="sm"
                className="w-full text-xs"
                cargando={downloading === 'all-sponsors'}
                onClick={() =>
                  void downloadPdf(
                    `/events/${eventId}/exports/sponsors-badges.pdf`,
                    `credenciales-auspiciantes.pdf`,
                    'all-sponsors'
                  )
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Descargar todas las credenciales (A4)
              </Button>
            </div>
          )}

          <ul className="mt-3 space-y-2.5">
            {sponsorList.length === 0 ? (
              <li className="text-xs text-muted italic p-3 text-center bg-canvas rounded-lg border border-dashed border-line">
                No hay auspiciantes registrados
              </li>
            ) : (
              sponsorList.map((s) => (
                <li
                  key={s.id}
                  className="text-sm rounded-[var(--radius-md)] border border-line bg-canvas p-3 space-y-2 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy leading-snug">{s.name}</div>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Auspiciador Oficial
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                    <Button
                      variant="secundario"
                      size="sm"
                      cargando={downloading === `sponsor-${s.id}`}
                      onClick={() =>
                        void downloadPdf(
                          `/sponsors/${s.id}/badge.pdf`,
                          `credencial-auspiciante-${s.name.replace(/\s+/g, '_')}.pdf`,
                          `sponsor-${s.id}`
                        )
                      }
                      title="Imprimir credencial individual"
                      className="text-xs font-semibold"
                    >
                      <IdCard className="mr-1 h-3.5 w-3.5 text-gold" />
                      Credencial
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="fantasma"
                        size="sm"
                        onClick={() =>
                          setEditingSponsor({
                            id: s.id,
                            name: s.name,
                          })
                        }
                        title="Editar auspiciante"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="peligro"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'sponsor',
                            id: s.id,
                            name: s.name,
                          })
                        }
                        title="Eliminar auspiciante"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="mt-4 pt-3 border-t border-line">
          <Button
            variant="secundario"
            className="w-full justify-center"
            onClick={() => {
              setSponsorName('');
              setAddDialog('sponsor');
            }}
          >
            + Agregar auspiciante
          </Button>
        </div>
      </section>

      {/* DIALOGS DE CREACIÓN */}
      {addDialog === 'session' && (
        <Dialog
          open={true}
          titulo="Agregar sesión o sala/mesa"
          onCerrar={() => setAddDialog(null)}
          accion={
            <Button variant="primario" onClick={() => void handleAddSession()}>
              Guardar
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="nueva-sesion-inicio"
              etiqueta="Fecha y hora de inicio"
              type="datetime-local"
              value={sessionAt}
              onChange={(e) => setSessionAt(e.target.value)}
              required
            />
            <Input
              id="nueva-sesion-fin"
              etiqueta="Fecha y hora de fin"
              opcional=" (opcional)"
              type="datetime-local"
              value={sessionEndsAt}
              onChange={(e) => setSessionEndsAt(e.target.value)}
            />
            <Input
              id="nueva-sesion-sala"
              etiqueta="Salón / Sala de la sesión"
              placeholder="Ej. Salón de Honor, Aula Magna"
              opcional=" (opcional)"
              value={sessionLocation}
              onChange={(e) => setSessionLocation(e.target.value)}
            />
            <Input
              id="nueva-sesion-mesa"
              etiqueta="Mesa / Track / Grupo de trabajo"
              placeholder="Ej. Mesa 1: Derecho Penal, Grupo B"
              opcional=" (opcional)"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
            />
          </div>
        </Dialog>
      )}

      {addDialog === 'speaker' && (
        <Dialog
          open={true}
          titulo="Agregar expositor o moderador"
          onCerrar={() => setAddDialog(null)}
          accion={
            <Button variant="primario" onClick={() => void handleAddSpeaker()}>
              Guardar
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="nuevo-expositor-nombre"
              etiqueta="Nombre completo con título"
              placeholder="Ej. Dr. Mario Ortiz Ruiz"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              required
            />
            <Input
              id="nuevo-expositor-rol"
              etiqueta="Rol en el evento"
              desplegable
              value={speakerRole}
              onChange={(e) => setSpeakerRole(e.target.value as 'EXPOSITOR' | 'MODERADOR')}
            >
              <option value="EXPOSITOR">Expositor / Ponente</option>
              <option value="MODERADOR">Moderador</option>
            </Input>
            <Input
              id="nuevo-expositor-profesion"
              etiqueta="Título o profesión"
              placeholder="Ej. PhD en Derecho Constitucional"
              opcional=" (opcional)"
              value={speakerTitle}
              onChange={(e) => setSpeakerTitle(e.target.value)}
            />
            <Input
              id="nuevo-expositor-institucion"
              etiqueta="Institución u organismo"
              placeholder="Ej. Universidad Mayor de San Andrés"
              opcional=" (opcional)"
              value={speakerInstitution}
              onChange={(e) => setSpeakerInstitution(e.target.value)}
            />
          </div>
        </Dialog>
      )}

      {addDialog === 'sponsor' && (
        <Dialog
          open={true}
          titulo="Agregar auspiciante"
          onCerrar={() => setAddDialog(null)}
          accion={
            <Button variant="primario" onClick={() => void handleAddSponsor()}>
              Guardar
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="nuevo-auspiciante"
              etiqueta="Nombre de la empresa o entidad"
              placeholder="Ej. Banco Nacional, Colegio de Abogados"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              required
            />
          </div>
        </Dialog>
      )}

      {/* DIALOGS DE EDICIÓN */}
      {editingSession && (
        <Dialog
          open={true}
          titulo="Editar sesión o sala/mesa"
          onCerrar={() => setEditingSession(null)}
          accion={
            <Button variant="primario" onClick={() => void handleUpdateSession()}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="edit-sesion-inicio"
              etiqueta="Fecha y hora de inicio"
              type="datetime-local"
              value={editingSession.startsAt}
              onChange={(e) =>
                setEditingSession((prev) => (prev ? { ...prev, startsAt: e.target.value } : null))
              }
              required
            />
            <Input
              id="edit-sesion-fin"
              etiqueta="Fecha y hora de fin"
              opcional=" (opcional)"
              type="datetime-local"
              value={editingSession.endsAt}
              onChange={(e) =>
                setEditingSession((prev) => (prev ? { ...prev, endsAt: e.target.value } : null))
              }
            />
            <Input
              id="edit-sesion-sala"
              etiqueta="Salón / Sala de la sesión"
              placeholder="Ej. Salón de Honor, Aula Magna"
              opcional=" (opcional)"
              value={editingSession.location}
              onChange={(e) =>
                setEditingSession((prev) => (prev ? { ...prev, location: e.target.value } : null))
              }
            />
            <Input
              id="edit-sesion-mesa"
              etiqueta="Mesa / Track / Grupo de trabajo"
              placeholder="Ej. Mesa 1: Derecho Penal, Grupo B"
              opcional=" (opcional)"
              value={editingSession.label}
              onChange={(e) =>
                setEditingSession((prev) => (prev ? { ...prev, label: e.target.value } : null))
              }
            />
          </div>
        </Dialog>
      )}

      {editingSpeaker && (
        <Dialog
          open={true}
          titulo="Editar expositor o moderador"
          onCerrar={() => setEditingSpeaker(null)}
          accion={
            <Button variant="primario" onClick={() => void handleUpdateSpeaker()}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="edit-expositor-nombre"
              etiqueta="Nombre completo con título"
              value={editingSpeaker.fullName}
              onChange={(e) =>
                setEditingSpeaker((prev) => (prev ? { ...prev, fullName: e.target.value } : null))
              }
              required
            />
            <Input
              id="edit-expositor-rol"
              etiqueta="Rol en el evento"
              desplegable
              value={editingSpeaker.role}
              onChange={(e) =>
                setEditingSpeaker((prev) =>
                  prev ? { ...prev, role: e.target.value as 'EXPOSITOR' | 'MODERADOR' } : null
                )
              }
            >
              <option value="EXPOSITOR">Expositor / Ponente</option>
              <option value="MODERADOR">Moderador</option>
            </Input>
            <Input
              id="edit-expositor-profesion"
              etiqueta="Título o profesión"
              opcional=" (opcional)"
              value={editingSpeaker.titleProfession}
              onChange={(e) =>
                setEditingSpeaker((prev) =>
                  prev ? { ...prev, titleProfession: e.target.value } : null
                )
              }
            />
            <Input
              id="edit-expositor-institucion"
              etiqueta="Institución u organismo"
              opcional=" (opcional)"
              value={editingSpeaker.institution}
              onChange={(e) =>
                setEditingSpeaker((prev) =>
                  prev ? { ...prev, institution: e.target.value } : null
                )
              }
            />
          </div>
        </Dialog>
      )}

      {editingSponsor && (
        <Dialog
          open={true}
          titulo="Editar auspiciante"
          onCerrar={() => setEditingSponsor(null)}
          accion={
            <Button variant="primario" onClick={() => void handleUpdateSponsor()}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="edit-auspiciante"
              etiqueta="Nombre de la empresa o entidad"
              value={editingSponsor.name}
              onChange={(e) =>
                setEditingSponsor((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
              required
            />
          </div>
        </Dialog>
      )}

      {/* DIÁLOGO ÚNICO DE CONFIRMACIÓN DE ELIMINACIÓN (Anti-Regression Rule 2) */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          titulo={`¿Eliminar ${deleteTarget.type === 'session' ? 'sesión' : deleteTarget.type === 'speaker' ? 'expositor' : 'auspiciante'}?`}
          mensaje={
            <p className="text-sm text-ink">
              ¿Está seguro de eliminar <strong>{deleteTarget.name}</strong>? Esta acción no se puede
              deshacer.
            </p>
          }
          confirmar="Eliminar"
          onConfirmar={() => void confirmDelete()}
          onCerrar={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
