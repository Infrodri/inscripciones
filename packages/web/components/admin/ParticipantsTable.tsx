'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getSessionUser, getToken } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditarInscritoDialog } from '@/components/admin/EditarInscritoDialog';

import { Input } from '@/components/ui/Input';
import { EmptyState, Table } from '@/components/ui/Table';
import { PdfPreviewDialog } from '@/components/admin/PdfPreviewDialog';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
  email: string | null;
  phone: string | null;
  type: string;
  source: string;
  createdAt: string;
  attended?: number;
  pct?: number;
  eligible?: boolean;
  certificateEmailedAt?: string | null;
  certificateEmailError?: string | null;
}

interface SessionRow {
  id: string;
  label: string | null;
  startsAt: string;
}

interface AttendanceRow {
  id: string;
  scannedAt: string;
  method: string;
  voidedAt: string | null;
  session: { id: string; label: string | null; startsAt: string };
}

async function download(url: string, filename: string): Promise<void> {
  const res = await fetch(apiUrl(url), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'No se pudo exportar');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function RowAttendances({ participantId, isAdmin }: { participantId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['participant-attendances', participantId],
    queryFn: async (): Promise<{ data: AttendanceRow[] }> =>
      (await api.get(`/participants/${participantId}/attendances`)).data,
  });

  async function annul(attendanceId: string): Promise<void> {
    const reason = window.prompt('Motivo de la anulación:');
    if (!reason) return;
    try {
      await api.post(`/attendances/${attendanceId}/void`, { reason });
      await queryClient.invalidateQueries({ queryKey: ['participant-attendances', participantId] });
      toast.success('Asistencia anulada');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  const rows = (data?.data ?? []).filter((a) => !a.voidedAt);
  if (rows.length === 0) return <p className="text-sm text-muted">Sin asistencias.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2">
          <span>
            {a.session.label ?? 'Sesión'} — {formatFechaHora(a.scannedAt)} ({a.method})
          </span>
          {isAdmin ? (
            <Button variant="secundario" size="sm" onClick={() => void annul(a.id)}>
              Anular
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ParticipantsTable({
  eventId,
  slug,
  onGoCertificados,
}: {
  eventId: string;
  slug: string;
  onGoCertificados: () => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [eligible, setEligible] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmPrint, setConfirmPrint] = useState<'all' | 'eligible' | 'selected' | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [deleting, setDeleting] = useState<Participant | null>(null);
  const [pageSize, setPageSize] = useState<number>(100);
  const user = getSessionUser();
  const isAdmin = user?.role === 'ADMIN';

  const list = useQuery({
    queryKey: ['participants', eventId, q, type, eligible, page, pageSize],
    queryFn: async (): Promise<{
      data: Participant[];
      pagination: { total: number; totalPages: number; page: number };
      totalSessions: number;
    }> =>
      (
        await api.get(`/participants/event/${eventId}`, {
          params: {
            q: q === '' ? undefined : q,
            type: type === '' ? undefined : type,
            eligible: eligible === '' ? undefined : eligible,
            stats: '1',
            page,
            pageSize,
          },
        })
      ).data,
  });
  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{ data: SessionRow[] }> =>
      (await api.get(`/sessions/event/${eventId}`)).data,
  });
  const sessionList = sessions.data?.data ?? [];
  const marks = useQuery({
    queryKey: ['marks', eventId, sessionList.map((s) => s.id).join(',')],
    queryFn: async (): Promise<Record<string, Set<string>>> => {
      const entries = await Promise.all(
        sessionList.map(async (s) => {
          const res = (await api.get(`/sessions/${s.id}/attendances`)).data as {
            data: Array<{ participant: { id: string } }>;
          };
          return [s.id, new Set(res.data.map((a) => a.participant.id))] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: sessionList.length > 0,
  });

  async function printDiplomas(kind: 'all' | 'eligible' | 'selected'): Promise<void> {
    setBusy(true);
    try {
      let url = `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=`;
      if (kind === 'all') url += 'all';
      else if (kind === 'eligible') url += 'eligible';
      else {
        if (selected.length === 0) {
          toast.error('Seleccione al menos un inscrito');
          return;
        }
        url += `selected&ids=${selected.join(',')}`;
      }
      const filename =
        kind === 'eligible'
          ? 'diplomas-aptos.pdf'
          : kind === 'all'
            ? 'diplomas-todos.pdf'
            : 'diplomas-seleccionados.pdf';
      await download(url, filename);
      toast.success('PDF generado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo exportar';
      if (message.includes('predeterminada')) {
        toast.error(message);
        onGoCertificados();
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
      setConfirmPrint(null);
    }
  }

  async function loadOnePdf(id: string): Promise<Blob> {
    const res = await fetch(
      apiUrl(
        `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=selected&ids=${id}`
      ),
      { headers: { Authorization: `Bearer ${getToken() ?? ''}` } }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      const message = body?.error?.message ?? 'No se pudo generar';
      if (message.includes('predeterminada')) onGoCertificados();
      throw new Error(message);
    }
    return res.blob();
  }

  async function exportFile(kind: string, format: string, filename: string): Promise<void> {
    try {
      const params = new URLSearchParams({ format });
      if (q.trim() !== '') params.set('q', q.trim());
      if (type !== '') params.set('type', type);
      await download(`/events/${eventId}/exports/${kind}?${params.toString()}`, filename);
    } catch {
      toast.error('No se pudo exportar');
    }
  }

  async function exportAttendanceList(): Promise<void> {
    try {
      const res = await fetch(apiUrl(`/events/${eventId}/exports/attendance-list.pdf`), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('No se pudo exportar');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `lista-asistencia-${slug}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('No se pudo exportar');
    }
  }

  async function exportBadges(): Promise<void> {
    try {
      const res = await fetch(apiUrl(`/events/${eventId}/exports/badges.pdf`), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('No se pudo exportar');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `credenciales-${slug}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('No se pudo exportar credenciales');
    }
  }

  async function resendQr(participant: Participant): Promise<void> {
    try {
      await api.post(`/participants/${participant.id}/resend-qr`);
      toast.success('QR reenviado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (list.isLoading) return <p>Cargando inscritos…</p>;
  if (list.isError)
    return <p>No se pudieron cargar los inscritos: {apiErrorMessage(list.error)}</p>;

  const rows = list.data?.data ?? [];
  const total = list.data?.pagination.total ?? 0;

  return (
    <section aria-label="Inscritos">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primario" size="md">
          <Link href="/admin/escaner">Inscribir en puerta</Link>
        </Button>
        <Button
          variant="secundario"
          disabled={busy}
          onClick={() => void exportFile('participants', 'xlsx', `inscritos-${slug}.xlsx`)}
        >
          Excel
        </Button>
        <Button
          variant="secundario"
          disabled={busy}
          onClick={() => void exportFile('participants', 'csv', `inscritos-${slug}.csv`)}
        >
          CSV
        </Button>
        <Button variant="secundario" disabled={busy} onClick={() => void exportAttendanceList()}>
          Lista PDF
        </Button>
        <Button variant="secundario" disabled={busy} onClick={() => void exportBadges()}>
          Credenciales PDF
        </Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <Input
          id="insc-q"
          etiqueta="Buscar"
          opcional=" (nombre, CI, correo)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Input
          id="insc-tipo"
          etiqueta="Tipo"
          desplegable
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Docente</option>
          <option value="PROFESIONAL">Profesional</option>
          <option value="PUBLICO">Público</option>
        </Input>
        <Input
          id="insc-apto"
          etiqueta="Aptitud"
          desplegable
          value={eligible}
          onChange={(e) => {
            setEligible(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="true">Aptos</option>
          <option value="false">No aptos</option>
        </Input>
        <Input
          id="insc-tamano"
          etiqueta="Mostrar por página"
          desplegable
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value="25">25 por página</option>
          <option value="50">50 por página</option>
          <option value="100">100 por página</option>
          <option value="200">200 por página</option>
          <option value="500">500 por página</option>
        </Input>
      </div>
      <p className="mt-2 text-sm">
        Total: <strong>{total}</strong>
        {selected.length > 0 ? (
          <>
            {' '}
            · Seleccionados: <strong>{selected.length}</strong>{' '}
            <Button variant="fantasma" size="sm" onClick={() => setConfirmPrint('selected')}>
              Imprimir seleccionados
            </Button>
          </>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secundario" onClick={() => setConfirmPrint('all')}>
          Imprimir todos los diplomas
        </Button>
        <Button variant="secundario" onClick={() => setConfirmPrint('eligible')}>
          Imprimir solo aptos
        </Button>
        <Button
          variant="secundario"
          onClick={() => {
            toast.loading('Generando credenciales en PDF…', { id: 'badges' });
            download(`/events/${eventId}/exports/badges.pdf`, `credenciales-${slug}.pdf`)
              .then(() => toast.success('Credenciales descargadas', { id: 'badges' }))
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : 'Error al generar credenciales', {
                  id: 'badges',
                })
              );
          }}
        >
          Exportar credenciales (PDF)
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState mensaje="Aún no hay inscritos." />
        </div>
      ) : (
        <div className="mt-3">
          <Table minWidth="min-w-[1180px]">
            <thead>
              <tr>
                <th aria-label="Seleccionar" className="w-12 text-center">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={rows.length > 0 && rows.every((p) => selected.includes(p.id))}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...new Set([...selected, ...rows.map((p) => p.id)])]
                          : selected.filter((id) => !rows.some((p) => p.id === id))
                      )
                    }
                    className="h-4 w-4 rounded border-line text-navy focus:ring-navy cursor-pointer"
                  />
                </th>
                <th className="min-w-[90px]">CI</th>
                <th className="min-w-[180px]">Nombre completo</th>
                <th className="min-w-[200px]">Correo</th>
                <th className="min-w-[110px]">Celular</th>
                <th className="min-w-[110px]">Tipo</th>
                <th className="min-w-[140px]">Inscrito el</th>
                {sessionList.map((s) => (
                  <th key={s.id} className="min-w-[90px] text-center">
                    {s.label ?? 'Sesión'}
                  </th>
                ))}
                <th className="w-16 text-center">%</th>
                <th className="w-24 text-center">Apto</th>
                <th className="min-w-[240px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-line hover:bg-canvas/50 transition-colors">
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${p.lastName}`}
                        checked={selected.includes(p.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, p.id]
                              : selected.filter((id) => id !== p.id)
                          )
                        }
                        className="h-4 w-4 rounded border-line text-navy focus:ring-navy cursor-pointer"
                      />
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">{p.ci}</td>
                    <td className="font-medium text-ink">
                      {p.lastName}, {p.firstName}
                      {p.certificateEmailedAt ? (
                        <span className="block text-xs font-normal text-ok">
                          Enviado {formatFechaHora(p.certificateEmailedAt)}
                        </span>
                      ) : p.certificateEmailError ? (
                        <span className="block text-xs font-normal text-danger">
                          Falló: {p.certificateEmailError}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs text-muted max-w-[220px] truncate" title={p.email ?? ''}>
                      {p.email ?? '—'}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap text-muted">
                      {p.phone ?? '—'}
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-canvas text-ink border border-line">
                        {p.type}
                      </span>
                    </td>
                    <td className="text-xs text-muted whitespace-nowrap">
                      {formatFechaHora(p.createdAt)}
                    </td>
                    {sessionList.map((s) => (
                      <td key={s.id} className="text-center font-bold text-xs">
                        {marks.data?.[s.id]?.has(p.id) ? (
                          <span className="text-ok">✓</span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>
                    ))}
                    <td className="text-center font-mono text-xs font-semibold">
                      {p.pct !== undefined ? `${Math.round(p.pct)}%` : '—'}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {p.eligible === undefined ? (
                        '—'
                      ) : (
                        <Badge tono={p.eligible ? 'ok' : 'aviso'}>
                          {p.eligible ? 'Apto' : 'No apto'}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="secundario" size="sm" onClick={() => setPreviewId(p.id)}>
                          Diploma
                        </Button>
                        <Button
                          variant="secundario"
                          size="sm"
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        >
                          Asistencia
                        </Button>
                        {isAdmin ? (
                          <>
                            <Button variant="secundario" size="sm" onClick={() => setEditing(p)}>
                              Editar
                            </Button>
                            <Button variant="secundario" size="sm" onClick={() => void resendQr(p)}>
                              Reenviar QR
                            </Button>
                            <Button variant="peligro" size="sm" onClick={() => setDeleting(p)}>
                              Eliminar
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded === p.id ? (
                    <tr key={`${p.id}-detalle`} className="bg-canvas/30">
                      <td colSpan={10 + sessionList.length} className="p-4 border-b border-line">
                        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                            Registro de Asistencias de {p.firstName} {p.lastName}
                          </p>
                          <RowAttendances participantId={p.id} isAdmin={isAdmin} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <Button
              variant="secundario"
              disabled={(list.data?.pagination.page ?? 1) <= 1}
              onClick={() => setPage((previous) => previous - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {list.data?.pagination.page} de {list.data?.pagination.totalPages}
            </span>
            <Button
              variant="secundario"
              disabled={
                (list.data?.pagination.page ?? 1) >= (list.data?.pagination.totalPages ?? 1)
              }
              onClick={() => setPage((previous) => previous + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {confirmPrint ? (
        <ConfirmDialog
          open={Boolean(confirmPrint)}
          titulo="Imprimir diplomas"
          mensaje={
            confirmPrint === 'all'
              ? `Se generará un PDF con TODOS los inscritos (${total}). Quienes no estén aptos también saldrán. Genere antes la vista previa de una página en la pestaña Asistentes.`
              : confirmPrint === 'eligible'
                ? 'Se generará un PDF solo con los aptos.'
                : `Se generará un PDF con ${selected.length} seleccionado(s).`
          }
          confirmar="Imprimir"
          onConfirmar={() => void printDiplomas(confirmPrint)}
          onCerrar={() => setConfirmPrint(null)}
        />
      ) : null}
      {previewId ? (
        <PdfPreviewDialog
          titulo="Diploma"
          totalPaginas={1}
          nombreArchivo="diploma.pdf"
          onCargar={() => loadOnePdf(previewId)}
          onCerrar={() => setPreviewId(null)}
        />
      ) : null}
      {editing ? (
        <EditarInscritoDialog
          eventId={eventId}
          participant={editing}
          onCerrar={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open={Boolean(deleting)}
          titulo="Eliminar inscrito"
          mensaje={`Eliminar a ${deleting.lastName}, ${deleting.firstName} (CI: ${deleting.ci})? Esta acción no se puede deshacer.`}
          confirmar="Eliminar"
          onConfirmar={async () => {
            try {
              await api.delete(`/participants/${deleting.id}`);
              toast.success('Inscrito eliminado');
              setDeleting(null);
            } catch (error) {
              toast.error(apiErrorMessage(error));
            }
          }}
          onCerrar={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
