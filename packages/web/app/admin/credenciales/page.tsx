'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiUrl, apiErrorMessage } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Table';
import { IdCard, Download, Users, Calendar, MapPin } from 'lucide-react';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  eventKind: string;
  location: string;
  status: string;
  participantsCount?: number;
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
  type: string;
  institution?: string;
  career?: string;
  qrToken: string;
}

export default function CredencialesPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [exporting, setExporting] = useState(false);

  // 1. Fetch accessible events
  const eventsQuery = useQuery({
    queryKey: ['admin-events-list'],
    queryFn: async () => {
      const res = await api.get('/events', { params: { pageSize: 50 } });
      const items = (res.data?.data ?? []) as EventItem[];
      if (items.length > 0 && !selectedEventId) {
        setSelectedEventId(items[0].id);
      }
      return items;
    },
  });

  const events = eventsQuery.data ?? [];
  const currentEvent = events.find((e) => e.id === selectedEventId) ?? events[0];

  // 2. Fetch participants of selected event
  const participantsQuery = useQuery({
    queryKey: ['admin-participants', selectedEventId, search, page, pageSize],
    queryFn: async () => {
      if (!selectedEventId) return { data: [], total: 0, totalPages: 1 };
      const res = await api.get(`/participants/event/${selectedEventId}`, {
        params: { q: search.trim() || undefined, pageSize, page },
      });
      return {
        data: (res.data?.data ?? []) as Participant[],
        total: Number(res.data?.pagination?.total ?? 0),
        totalPages: Number(res.data?.pagination?.totalPages ?? 1),
      };
    },
    enabled: Boolean(selectedEventId),
  });

  const participants = participantsQuery.data?.data ?? [];
  const totalParticipants = participantsQuery.data?.total ?? 0;
  const totalPages = participantsQuery.data?.totalPages ?? 1;

  // Batch download A4 sheets
  async function downloadBatchBadges() {
    if (!currentEvent) return;
    setExporting(true);
    try {
      const res = await fetch(apiUrl(`/events/${currentEvent.id}/exports/badges.pdf`), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'Error al generar credenciales');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credenciales-${currentEvent.slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Lote de credenciales descargado exitosamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  // Single badge download
  function downloadSingleBadge(qrToken: string, ci: string) {
    const url = apiUrl(`/public/registrations/${qrToken}/badge.pdf`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credencial-${ci}.pdf`;
    a.target = '_blank';
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        migas={[{ etiqueta: 'Administración' }, { etiqueta: 'Emisión de Credenciales' }]}
        volverA="/admin/eventos"
        titulo="Credenciales y Solaperas Académicas"
        descripcion="Generación e impresión de tarjetas de identificación con código QR institucional para control de acceso y lanyards."
      />

      {/* Event Selector & Actions Bar */}
      <Card className="p-6 border border-line bg-surface rounded-xl shadow-soft space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="w-full md:max-w-md">
            <Input
              id="event-select"
              etiqueta="Seleccionar Evento Académico"
              desplegable
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setPage(1);
              }}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.eventKind})
                </option>
              ))}
            </Input>
          </div>

          <Button
            variant="primario"
            size="lg"
            cargando={exporting}
            onClick={() => void downloadBatchBadges()}
            disabled={!currentEvent || totalParticipants === 0}
            className="!text-white shrink-0 shadow-soft"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar Lote de Credenciales (PDF A4)
          </Button>
        </div>

        {currentEvent ? (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-line text-xs text-muted">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <Calendar className="h-3.5 w-3.5 text-gold" />
              {currentEvent.eventKind}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {currentEvent.location}
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-navy bg-canvas px-2.5 py-1 rounded-md border border-line">
              <Users className="h-3.5 w-3.5" />
              {totalParticipants} Asistentes Registrados
            </span>
          </div>
        ) : null}
      </Card>

      {/* Participants Filter and List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:max-w-md">
            <div className="flex-1 min-w-[200px]">
              <Input
                id="search-att"
                etiqueta="Buscar inscrito"
                placeholder="Nombre, apellido o CI…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-32">
              <Input
                id="cred-page-size"
                etiqueta="Por página"
                desplegable
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10 por pág.</option>
                <option value="20">20 por pág.</option>
                <option value="50">50 por pág.</option>
              </Input>
            </div>
          </div>
          <p className="text-xs text-muted self-end sm:self-center">
            Pág. {page} ({participants.length} de {totalParticipants} inscritos)
          </p>
        </div>

        {participantsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted bg-surface rounded-xl border border-line">
            Cargando asistentes…
          </div>
        ) : participants.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted bg-surface rounded-xl border border-line">
            No se encontraron participantes registrados en este evento.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((p) => (
              <Card
                key={p.id}
                className="p-4 border border-line bg-surface rounded-xl hover:border-gold/50 transition-colors shadow-soft flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-navy text-white">
                      {p.type}
                    </span>
                    <span className="text-xs font-mono font-medium text-muted">CI: {p.ci}</span>
                  </div>
                  <h3 className="font-serif font-bold text-navy text-sm sm:text-base leading-snug">
                    {p.firstName} {p.lastName}
                  </h3>
                  <p className="text-xs text-muted truncate">
                    {p.career || p.institution || 'Universidad San Francisco Xavier'}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-line flex items-center justify-between">
                  <span className="text-[11px] text-muted flex items-center gap-1 font-mono">
                    <IdCard className="h-3.5 w-3.5 text-gold" />
                    QR: {p.qrToken.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadSingleBadge(p.qrToken, p.ci)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-navy-hover transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Credencial
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secundario"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secundario"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
