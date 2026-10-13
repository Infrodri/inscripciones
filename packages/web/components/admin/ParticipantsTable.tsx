'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, getSessionUser, getToken } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { EmptyState, Table } from '@/components/ui/Table';

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
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
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
  if (rows.length === 0) return <p className="text-sm text-[#5B6677]">Sin asistencias.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2">
          <span>
            {a.session.label ?? 'Sesión'} — {formatFechaHora(a.scannedAt)} ({a.method})
          </span>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void annul(a.id)}
              className="min-h-[44px] rounded-[8px] border border-[#D9DEE7] px-2 py-1"
            >
              Anular
            </button>
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
  const user = getSessionUser();
  const isAdmin = user?.role === 'ADMIN';

  const list = useQuery({
    queryKey: ['participants', eventId, q, type, eligible, page],
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

  async function printOne(id: string): Promise<void> {
    setBusy(true);
    try {
      await download(
        `/events/${eventId}/exports/certificates.pdf?roleKind=ASISTENTE&scope=selected&ids=${id}`,
        'diploma.pdf'
      );
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
    }
  }

  async function exportFile(kind: string, format: string, filename: string): Promise<void> {
    try {
      await download(`/events/${eventId}/exports/${kind}?format=${format}`, filename);
    } catch {
      toast.error('No se pudo exportar');
    }
  }

  async function exportAttendanceList(): Promise<void> {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}/exports/attendance-list.pdf`,
        { headers: { Authorization: `Bearer ${getToken() ?? ''}` } }
      );
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

  if (list.isLoading) return <p>Cargando inscritos…</p>;
  if (list.isError)
    return <p>No se pudieron cargar los inscritos: {apiErrorMessage(list.error)}</p>;

  const rows = list.data?.data ?? [];
  const total = list.data?.pagination.total ?? 0;

  return (
    <section aria-label="Inscritos">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/escaner"
          className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[#0A2A5E] px-4 py-2 text-white"
        >
          Inscribir en puerta
        </Link>
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
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
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
      </div>
      <p className="mt-2 text-sm">
        Total: <strong>{total}</strong>
        {selected.length > 0 ? (
          <>
            {' '}
            · Seleccionados: <strong>{selected.length}</strong>{' '}
            <button type="button" onClick={() => setConfirmPrint('selected')} className="underline">
              Imprimir seleccionados
            </button>
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
      </div>
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState mensaje="Aún no hay inscritos." />
        </div>
      ) : (
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <th aria-label="Seleccionar">
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
                    className="h-5 w-5"
                  />
                </th>
                <th>CI</th>
                <th>Nombre completo</th>
                <th>Correo</th>
                <th>Celular</th>
                <th>Tipo</th>
                <th>Inscrito el</th>
                {sessionList.map((s) => (
                  <th key={s.id}>{s.label ?? 'Sesión'}</th>
                ))}
                <th>%</th>
                <th>Apto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-[#D9DEE7]">
                    <td>
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
                        className="h-5 w-5"
                      />
                    </td>
                    <td>{p.ci}</td>
                    <td>
                      {p.lastName}, {p.firstName}
                    </td>
                    <td>{p.email ?? '—'}</td>
                    <td>{p.phone ?? '—'}</td>
                    <td>{p.type}</td>
                    <td>{formatFechaHora(p.createdAt)}</td>
                    {sessionList.map((s) => (
                      <td key={s.id}>{marks.data?.[s.id]?.has(p.id) ? '✓' : '—'}</td>
                    ))}
                    <td>{p.pct !== undefined ? `${Math.round(p.pct)}%` : '—'}</td>
                    <td>
                      {p.eligible === undefined ? (
                        '—'
                      ) : (
                        <Badge tono={p.eligible ? 'ok' : 'aviso'}>
                          {p.eligible ? 'Apto' : 'No apto'}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void printOne(p.id)}
                          className="min-h-[44px] rounded-[8px] border border-[#D9DEE7] px-2 py-1"
                        >
                          Diploma
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          className="min-h-[44px] rounded-[8px] border border-[#D9DEE7] px-2 py-1"
                        >
                          Asistencia
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === p.id ? (
                    <tr key={`${p.id}-detalle`}>
                      <td colSpan={10 + sessionList.length}>
                        <RowAttendances participantId={p.id} isAdmin={isAdmin} />
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
    </section>
  );
}
