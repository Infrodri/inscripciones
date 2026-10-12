'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { Card } from '@/components/ui/Card';

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

  if (stats.isLoading) return <p>Cargando resumen…</p>;
  if (stats.isError) return <p>No se pudo cargar: {apiErrorMessage(stats.error)}</p>;

  const last = stats.data?.perSession[stats.data.perSession.length - 1];
  const pendientes: Array<{ texto: string; tab: string }> = [];
  if (!event.data?.bannerPath) pendientes.push({ texto: 'Subir el afiche', tab: 'datos' });
  if ((sessions.data?.data.length ?? 0) === 0)
    pendientes.push({ texto: 'Agregar una sesión', tab: 'datos' });
  if (!(templates.data?.data ?? []).some((t) => t.isDefault))
    pendientes.push({ texto: 'Plantilla de asistente predeterminada', tab: 'certificados' });
  if (event.data?.status === 'BORRADOR')
    pendientes.push({ texto: 'Publicar el evento', tab: 'inscripcion' });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[#5B6677]">Inscritos</p>
          <p className="font-serif text-3xl">{stats.data?.participants ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-[#5B6677]">Asistentes (última sesión)</p>
          <p className="font-serif text-3xl">{last?.checkedIn ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-[#5B6677]">Aptos</p>
          <p className="font-serif text-3xl">{stats.data?.eligible ?? 0}</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Próximos pasos</h2>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-sm">Todo listo para el evento.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pendientes.map((p) => (
              <li key={p.texto} className="text-sm">
                <Link href={`/admin/eventos/${eventId}?tab=${p.tab}`} className="underline">
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
