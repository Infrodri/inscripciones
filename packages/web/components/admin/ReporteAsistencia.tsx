'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState, Table } from '@/components/ui/Table';
import { PdfPreviewDialog } from '@/components/admin/PdfPreviewDialog';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
  attended?: number;
  pct?: number;
  eligible?: boolean;
}

interface SessionRow {
  id: string;
  label: string | null;
  startsAt: string;
}

async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'No se pudo generar');
  }
  return res.blob();
}

// Matriz inscritos × sesiones (presente/ausente/método), % y apto.
export function ReporteAsistencia({ eventId, slug }: { eventId: string; slug: string }) {
  const [sessionFilter, setSessionFilter] = useState('');
  const [eligibleFilter, setEligibleFilter] = useState('');
  const [preview, setPreview] = useState(false);

  const participants = useQuery({
    queryKey: ['report-participants', eventId],
    queryFn: async (): Promise<{ data: Participant[] }> =>
      (await api.get(`/participants/event/${eventId}`, { params: { stats: '1', pageSize: 200 } }))
        .data,
  });
  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{ data: SessionRow[] }> =>
      (await api.get(`/sessions/event/${eventId}`)).data,
  });
  const marks = useQuery({
    queryKey: ['report-marks', eventId],
    queryFn: async (): Promise<Record<string, Record<string, string>>> => {
      const sessionList = (sessions.data?.data ?? []) as SessionRow[];
      const out: Record<string, Record<string, string>> = {};
      await Promise.all(
        sessionList.map(async (s) => {
          const res = (await api.get(`/sessions/${s.id}/attendances`)).data as {
            data: Array<{ method: string; participant: { id: string } }>;
          };
          for (const a of res.data) {
            out[a.participant.id] = { ...(out[a.participant.id] ?? {}), [s.id]: a.method };
          }
        })
      );
      return out;
    },
    enabled: (sessions.data?.data.length ?? 0) > 0,
  });

  if (participants.isLoading) return <p>Cargando reporte…</p>;
  if (participants.isError) return <p>No se pudo cargar: {apiErrorMessage(participants.error)}</p>;

  const sessionList = (
    sessionFilter
      ? (sessions.data?.data ?? []).filter((s) => s.id === sessionFilter)
      : (sessions.data?.data ?? [])
  ) as SessionRow[];
  let rows = participants.data?.data ?? [];
  if (eligibleFilter === 'true') rows = rows.filter((p) => p.eligible);
  if (eligibleFilter === 'false') rows = rows.filter((p) => !p.eligible);
  const shown = rows.slice(0, 20);
  const totals: Record<string, number> = {};
  for (const s of sessionList) {
    totals[s.id] = rows.filter((p) => marks.data?.[p.id]?.[s.id]).length;
  }

  async function exportFile(format: 'xlsx' | 'csv'): Promise<void> {
    try {
      const blob = await fetchBlob(`/events/${eventId}/exports/attendance?format=${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia-${slug}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportación generada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar');
    }
  }

  return (
    <Card>
      <h2 className="font-serif text-lg text-navy">Reporte de asistencia</h2>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Input
          id="rep-sesion"
          etiqueta="Sesión"
          desplegable
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
        >
          <option value="">Todas</option>
          {((sessions.data?.data ?? []) as SessionRow[]).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label ?? 'Sesión'}
            </option>
          ))}
        </Input>
        <Input
          id="rep-apto"
          etiqueta="Aptitud"
          desplegable
          value={eligibleFilter}
          onChange={(e) => setEligibleFilter(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="true">Aptos</option>
          <option value="false">No aptos</option>
        </Input>
      </div>
      <p className="mt-2 text-sm">
        Total: <strong>{rows.length}</strong>
        {rows.length > 20
          ? ' — mostrando las primeras 20 filas; la exportación incluye todas.'
          : ''}
      </p>
      {rows.length === 0 ? (
        <div className="mt-2">
          <EmptyState mensaje="Sin resultados para estos filtros." />
        </div>
      ) : (
        <div className="mt-2">
          <Table>
            <thead>
              <tr>
                <th>CI</th>
                <th>Nombre</th>
                {sessionList.map((s) => (
                  <th key={s.id}>{s.label ?? 'Sesión'}</th>
                ))}
                <th>%</th>
                <th>Apto</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td>{p.ci}</td>
                  <td>
                    {p.lastName}, {p.firstName}
                  </td>
                  {sessionList.map((s) => (
                    <td key={s.id}>{marks.data?.[p.id]?.[s.id] ?? '—'}</td>
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
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-sm">
            Totales por sesión:{' '}
            {sessionList.map((s) => `${s.label ?? 'Sesión'}: ${totals[s.id] ?? 0}`).join(' · ')}
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secundario" onClick={() => void exportFile('xlsx')}>
          Exportar XLSX
        </Button>
        <Button variant="secundario" onClick={() => void exportFile('csv')}>
          Exportar CSV
        </Button>
        <Button variant="secundario" onClick={() => setPreview(true)}>
          Vista previa de lista
        </Button>
      </div>
      {preview ? (
        <PdfPreviewDialog
          titulo="Lista de asistencia"
          totalPaginas={null}
          nombreArchivo={`lista-asistencia-${slug}.pdf`}
          onCargar={() => fetchBlob(`/events/${eventId}/exports/attendance-list.pdf`)}
          onCerrar={() => setPreview(false)}
        />
      ) : null}
    </Card>
  );
}
