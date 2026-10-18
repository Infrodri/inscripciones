'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage, getSessionUser } from '@/lib/api';
import { formatFecha } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, PageHeader } from '@/components/ui/Table';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  participants?: number;
  participantsCount?: number;
  speakersCount?: number;
  sessionsCount?: number;
}

interface EventCardProps {
  event: EventRow;
  onDelete?: (event: EventRow) => void;
  participants?: number;
  onSelect?: (id: string, selected: boolean) => void;
  selected?: boolean;
}

function EventCard({ event, onDelete, participants, onSelect, selected }: EventCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const stats = useQuery({
    queryKey: ['stats', event.id],
    queryFn: async (): Promise<{ participants: number }> =>
      (await api.get(`/events/${event.id}/stats`)).data,
    enabled: participants === undefined && event.participants === undefined,
  });
  const sessions = useQuery({
    queryKey: ['sessions', event.id],
    queryFn: async (): Promise<{ data: Array<{ startsAt: string }> }> =>
      (await api.get(`/sessions/event/${event.id}`)).data,
  });
  const dates = (sessions.data?.data ?? []).map((s) => s.startsAt).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const inscritosCount = participants ?? event.participants ?? stats.data?.participants ?? 0;

  async function duplicate(): Promise<void> {
    const title = window.prompt('Título del nuevo evento:', `${event.title} (copia)`);
    if (!title) return;
    const slug = window.prompt('Slug del nuevo evento:', `${event.slug}-copia`);
    if (!slug) return;
    try {
      const res = await api.post(`/events/${event.id}/duplicate`, { title, slug, daysShift: 1 });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento duplicado');
      router.push(`/admin/eventos/${(res.data as { id: string }).id}`);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  return (
    <Card className="bg-surface border-line shadow-soft rounded-[var(--radius-md)]">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelect?.(event.id, e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-line text-navy focus:ring-navy"
          aria-label={`Seleccionar ${event.title}`}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink truncate">
            <Link href={`/admin/eventos/${event.id}`} className="hover:underline text-navy-hover">
              {event.title}
            </Link>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tono={event.status}>{event.status}</Badge>
            {first ? <span>desde {formatFecha(first)}</span> : <span>sin fecha</span>}
            {last && last !== first ? <span>hasta {formatFecha(last)}</span> : null}
            <span className="font-medium text-ink">Inscritos: {inscritosCount}</span>
            {event.speakersCount !== undefined && event.speakersCount > 0 ? (
              <span>• Expositores: {event.speakersCount}</span>
            ) : null}
            {event.sessionsCount !== undefined && event.sessionsCount > 0 ? (
              <span>• Sesiones: {event.sessionsCount}</span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="primario" size="sm">
              <Link href={`/admin/eventos/${event.id}`}>Abrir</Link>
            </Button>
            <Button variant="secundario" size="sm" onClick={() => void duplicate()}>
              Duplicar
            </Button>
            {onDelete && (
              <Button variant="peligro" size="sm" onClick={() => onDelete(event)}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function EventosPage() {
  const queryClient = useQueryClient();
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === 'ADMIN';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTestFilter, setShowTestFilter] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleteText, setBulkDeleteText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: EventRow[] }> => (await api.get('/events')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ ids, titles }: { ids: string[]; titles?: Record<string, string> }) =>
      api.post('/events/bulk-delete', { ids, titles }),
    onSuccess: () => {
      toast.success('Eventos eliminados');
      setSelectedIds([]);
      setBulkDeleteConfirm(false);
      setBulkDeleteText('');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const filteredEvents =
    data?.data.filter((e) => {
      if (!showTestFilter) return true;
      return /^(Evento H1|Copia H1|Evento E2E)/.test(e.title);
    }) ?? [];

  const selectedEvents = data?.data.filter((e) => selectedIds.includes(e.id)) ?? [];
  const totalSelectedInscritos = selectedEvents.reduce((sum, e) => sum + (e.participants ?? 0), 0);
  const hasInscritosInSelection = selectedEvents.some((e) => (e.participants ?? 0) > 0);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((id) => id !== id)));
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(filteredEvents.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  }

  const handleBulkDelete = async () => {
    if (bulkDeleteText !== 'ELIMINAR') {
      toast.error('Debe escribir "ELIMINAR" para confirmar');
      return;
    }
    const titles = Object.fromEntries(selectedEvents.map((e) => [e.id, e.title]));
    try {
      await deleteMutation.mutateAsync({ ids: selectedIds, titles });
    } catch {
      // Manejado en onError
    }
  };

  if (isLoading) return <p className="text-muted">Cargando eventos…</p>;
  if (isError)
    return (
      <p className="text-danger">No se pudieron cargar los eventos: {apiErrorMessage(error)}</p>
    );
  if (!data || data.data.length === 0) {
    return (
      <div className="bg-surface rounded-[var(--radius-md)] border border-line p-6">
        <PageHeader titulo="Eventos" migas={[{ etiqueta: 'Eventos' }]} />
        <div className="mt-4">
          <EmptyState
            mensaje="Aún no hay eventos. Cree el primero."
            accion={
              <Button asChild>
                <Link href="/admin/eventos/nuevo">Nuevo evento</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[var(--radius-md)] border border-line p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <PageHeader titulo="Eventos" migas={[{ etiqueta: 'Eventos' }]} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secundario" size="sm" onClick={() => setShowTestFilter(!showTestFilter)}>
            {showTestFilter ? 'Mostrar todos' : 'Eventos de prueba'}
          </Button>
          <Button asChild>
            <Link href="/admin/eventos/nuevo">Nuevo evento</Link>
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 p-3 bg-warn-bg border border-warn rounded-[var(--radius-md)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-warn">
            <input
              type="checkbox"
              checked={
                filteredEvents.length > 0 && filteredEvents.every((e) => selectedIds.includes(e.id))
              }
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4 rounded border-line text-navy focus:ring-navy"
            />
            <span>
              {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
              {totalSelectedInscritos > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-warn text-warn text-xs rounded">
                  {totalSelectedInscritos} inscrito{totalSelectedInscritos > 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secundario" size="sm" onClick={() => toggleAll(false)}>
              Deseleccionar
            </Button>
            <Button variant="peligro" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
              Eliminar seleccionados
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {filteredEvents.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            onDelete={isAdmin ? (event) => setDeleteTarget(event) : undefined}
            participants={e.participants}
            onSelect={toggleSelect}
            selected={selectedIds.includes(e.id)}
          />
        ))}
      </div>

      {selectedIds.length === 0 && filteredEvents.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={
              filteredEvents.length > 0 && filteredEvents.every((e) => selectedIds.includes(e.id))
            }
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 rounded border-line text-navy focus:ring-navy"
            id="select-all"
          />
          <label htmlFor="select-all" className="text-sm text-muted cursor-pointer">
            Seleccionar todos ({filteredEvents.length})
          </label>
        </div>
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          titulo="Eliminar eventos seleccionados"
          mensaje={
            <div className="space-y-3">
              <p className="text-sm">
                Se eliminarán <strong>{selectedIds.length}</strong> evento
                {selectedIds.length > 1 ? 's' : ''}:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-sm max-h-48 overflow-auto">
                {selectedEvents.map((e) => (
                  <li
                    key={e.id}
                    className={(e.participants ?? 0) > 0 ? 'text-danger font-medium' : ''}
                  >
                    {e.title}{' '}
                    {(e.participants ?? 0) > 0 && (
                      <span className="text-danger"> ({e.participants ?? 0} inscritos)</span>
                    )}
                  </li>
                ))}
              </ul>
              {hasInscritosInSelection && (
                <p className="text-sm text-danger">
                  ⚠ {selectedEvents.filter((e) => (e.participants ?? 0) > 0).length} evento
                  {selectedEvents.filter((e) => (e.participants ?? 0) > 0).length > 1
                    ? 's'
                    : ''}{' '}
                  tienen inscritos y se borrarán en cascada.
                </p>
              )}
              <p className="text-sm">
                Total de inscritos afectados: <strong>{totalSelectedInscritos}</strong>
              </p>
              <p className="text-sm text-muted">
                Escriba <kbd className="px-1.5 py-0.5 bg-line rounded text-ink">ELIMINAR</kbd> para
                confirmar:
              </p>
              <input
                type="text"
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                placeholder="Escriba ELIMINAR"
                className="w-full mt-2 px-3 py-2 rounded-[var(--radius-md)] border border-line bg-surface text-ink"
                autoFocus
              />
            </div>
          }
          confirmar="Eliminar"
          onConfirmar={handleBulkDelete}
          onCerrar={() => {
            setBulkDeleteConfirm(false);
            setBulkDeleteText('');
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          titulo="Eliminar evento"
          mensaje={`¿Eliminar "${deleteTarget.title}"? Esta acción no se puede deshacer.`}
          confirmar="Eliminar"
          onConfirmar={async () => {
            try {
              await api.delete(`/events/${deleteTarget.id}`, {
                data: { title: deleteTarget.title },
              });
              await queryClient.invalidateQueries({ queryKey: ['events'] });
              toast.success('Evento eliminado');
            } catch (error) {
              toast.error(apiErrorMessage(error));
            } finally {
              setDeleteTarget(null);
            }
          }}
          onCerrar={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
