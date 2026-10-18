'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Stats {
  participants: number;
  eligible: number;
  sessions: number;
  perSession: Array<{ checkedIn: number }>;
}

export function ResumenTab({ eventId }: { eventId: string }) {
  const stats = useQuery({
    queryKey: ['stats', eventId],
    queryFn: async (): Promise<Stats> => (await api.get(`/events/${eventId}/stats`)).data,
  });
  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<{
      status: string;
      bannerPath: string | null;
      slug: string;
    }> => (await api.get(`/events/${eventId}`)).data,
  });
  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{ data: unknown[] }> =>
      (await api.get(`/sessions/event/${eventId}`)).data,
  });
  const templates = useQuery({
    queryKey: ['templates-asistente', eventId],
    queryFn: async (): Promise<{ data: Array<{ isDefault: boolean }> }> =>
      (
        await api.get(`/events/${eventId}/certificate-templates`, {
          params: { roleKind: 'ASISTENTE' },
        })
      ).data,
  });

  if (stats.isLoading) return <p className="text-muted">Cargando métricas del evento…</p>;
  if (stats.isError)
    return (
      <p className="text-danger">No se pudieron cargar los datos: {apiErrorMessage(stats.error)}</p>
    );

  const last = stats.data?.perSession[stats.data.perSession.length - 1];
  const pendientes: Array<{ texto: string; tab: string; accion: string }> = [];
  if (!event.data?.bannerPath)
    pendientes.push({
      texto: 'Subir el afiche oficial del evento',
      tab: 'datos',
      accion: 'Subir afiche',
    });
  if ((sessions.data?.data.length ?? 0) === 0)
    pendientes.push({
      texto: 'Configurar al menos una sesión con fecha y hora',
      tab: 'datos',
      accion: 'Agregar sesión',
    });
  if (!(templates.data?.data ?? []).some((t) => t.isDefault))
    pendientes.push({
      texto: 'Cargar plantilla de certificado para asistentes',
      tab: 'certificados',
      accion: 'Gestionar plantillas',
    });
  if (event.data?.status === 'BORRADOR')
    pendientes.push({
      texto: 'Publicar el evento para habilitar inscripciones',
      tab: 'inscripcion',
      accion: 'Ir a publicación',
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Total Inscritos
            </span>
            <span className="h-8 w-8 rounded-full bg-blue-bg flex items-center justify-center text-navy font-bold text-sm">
              👥
            </span>
          </div>
          <p className="mt-4 font-serif text-3xl md:text-4xl font-bold text-navy">
            {stats.data?.participants ?? 0}
          </p>
          <span className="mt-2 text-xs text-muted">Participantes registrados</span>
        </Card>

        <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Asistentes
            </span>
            <span className="h-8 w-8 rounded-full bg-ok-bg flex items-center justify-center text-ok font-bold text-sm">
              ✓
            </span>
          </div>
          <p className="mt-4 font-serif text-3xl md:text-4xl font-bold text-ok">
            {last?.checkedIn ?? 0}
          </p>
          <span className="mt-2 text-xs text-muted">En la última sesión realizada</span>
        </Card>

        <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Aptos Certificado
            </span>
            <span className="h-8 w-8 rounded-full bg-warn-bg flex items-center justify-center text-warn font-bold text-sm">
              ★
            </span>
          </div>
          <p className="mt-4 font-serif text-3xl md:text-4xl font-bold text-ink">
            {stats.data?.eligible ?? 0}
          </p>
          <span className="mt-2 text-xs text-muted">Cumplen el % mínimo de asistencia</span>
        </Card>
      </div>

      <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-serif text-lg font-bold text-navy border-b border-line pb-2">
          Lista de preparación del evento
        </h2>
        {pendientes.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-ok-bg text-ok">
            <span className="text-xl">✓</span>
            <p className="text-sm font-medium">
              Todo listo: el evento cuenta con afiche, sesiones, plantilla de certificados e
              inscripciones activas.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-line">
            {pendientes.map((p) => (
              <div
                key={p.texto}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-warn inline-block"></span>
                  <span className="text-sm text-ink">{p.texto}</span>
                </div>
                <Button asChild variant="secundario" size="sm">
                  <Link href={`/admin/eventos/${eventId}?tab=${p.tab}`}>{p.accion}</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
