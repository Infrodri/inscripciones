'use client';

import { use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { formatFecha } from '@/lib/format';
import { ResumenTab } from '@/components/admin/event-tabs/ResumenTab';
import { InscripcionTab } from '@/components/admin/event-tabs/InscripcionTab';
import { AsistenciaTab } from '@/components/admin/event-tabs/AsistenciaTab';
import { DatosTab } from '@/components/admin/event-tabs/DatosTab';
import { ParticipantsTable } from '@/components/admin/ParticipantsTable';

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  location: string;
}

const TABS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'inscripcion', etiqueta: 'Inscripción' },
  { id: 'asistencia', etiqueta: 'Asistencia' },
  { id: 'inscritos', etiqueta: 'Inscritos' },
  { id: 'certificados', etiqueta: 'Certificados' },
  { id: 'datos', etiqueta: 'Datos' },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

export default function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const rawTab = searchParams.get('tab');
  const tab = rawTab && VALID_TABS.has(rawTab) ? rawTab : 'resumen';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['event', id],
    queryFn: async (): Promise<EventDetail> => (await api.get(`/events/${id}`)).data,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', id],
    queryFn: async (): Promise<{ data: Array<{ startsAt: string }> }> =>
      (await api.get(`/sessions/event/${id}`)).data,
  });

  function goTab(next: string): void {
    router.replace(`/admin/eventos/${id}?tab=${next}`);
  }

  async function publish(): Promise<void> {
    try {
      const pub = (await api.get(`/public/events/${data?.slug}`)).data as {
        bannerUrl: string | null;
        sessions: unknown[];
      };
      const warnings: string[] = [];
      if (!pub.bannerUrl) warnings.push('sin afiche');
      if (pub.sessions.length === 0) warnings.push('sin sesiones');
      const extra =
        warnings.length > 0 ? ` Advertencia: el evento está ${warnings.join(' y ')}.` : '';
      if (!window.confirm(`¿Publicar este evento?${extra}`)) return;
      await api.post(`/events/${id}/publish`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Evento publicado');
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status !== 401)
        toast.error(apiErrorMessage(err));
    }
  }

  async function close(): Promise<void> {
    try {
      if (!window.confirm('¿Cerrar las inscripciones? Se pueden reabrir después.')) return;
      await api.post(`/events/${id}/close`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Inscripciones cerradas');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function reopen(): Promise<void> {
    try {
      await api.post(`/events/${id}/reopen`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Inscripciones reabiertas');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (isLoading) return <p>Cargando evento…</p>;
  if (isError || !data)
    return <p>No se pudo cargar el evento: {isError ? apiErrorMessage(error) : ''}</p>;

  const firstSession = [...(sessionsQuery.data?.data ?? [])].sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : 1
  )[0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl text-[#0A2A5E]">{data.title}</h1>
          <p className="mt-1 text-sm text-[#5B6677]">
            <Badge tono={data.status}>{data.status}</Badge> {data.location}
            {firstSession ? ` · desde ${formatFecha(firstSession.startsAt)}` : ''}
          </p>
        </div>
        {data.status === 'BORRADOR' ? (
          <Button onClick={() => void publish()}>Publicar</Button>
        ) : data.status === 'ABIERTO' ? (
          <Button variant="secundario" onClick={() => void close()}>
            Cerrar inscripciones
          </Button>
        ) : data.status === 'CERRADO' ? (
          <Button onClick={() => void reopen()}>Reabrir</Button>
        ) : null}
      </div>
      <div className="mt-4">
        <Tabs tabs={TABS} activa={tab} onChange={goTab} />
      </div>
      <div className="mt-4">
        {tab === 'resumen' ? <ResumenTab eventId={id} /> : null}
        {tab === 'inscripcion' ? <InscripcionTab eventId={id} /> : null}
        {tab === 'asistencia' ? <AsistenciaTab eventId={id} /> : null}
        {tab === 'inscritos' ? (
          <ParticipantsTable
            eventId={id}
            slug={data.slug}
            onGoCertificados={() => goTab('certificados')}
          />
        ) : null}
        {tab === 'certificados' ? (
          <p className="text-sm">
            Los certificados se gestionan en su página:{' '}
            <a href={`/admin/eventos/${id}/certificados`} className="underline">
              Ir a Certificados
            </a>
          </p>
        ) : null}
        {tab === 'datos' ? <DatosTab eventId={id} /> : null}
      </div>
    </div>
  );
}
