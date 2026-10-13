'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { TemplateManager } from '@/components/admin/TemplateManager';
import { AsistentesTab } from '@/components/admin/AsistentesTab';
import { ExpositoresTab } from '@/components/admin/ExpositoresTab';
import { OrganizadoresTab } from '@/components/admin/OrganizadoresTab';

const TABS = [
  { id: 'plantillas', etiqueta: 'Plantillas' },
  { id: 'asistentes', etiqueta: 'Asistentes' },
  { id: 'expositores', etiqueta: 'Expositores' },
  { id: 'organizadores', etiqueta: 'Organizadores' },
  { id: 'exportar', etiqueta: 'Exportar' },
];

const VALID = new Set(TABS.map((t) => t.id));

export default function CertificadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get('sub');
  const tab = raw && VALID.has(raw) ? raw : 'plantillas';
  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: async (): Promise<{ slug: string; title: string }> =>
      (await api.get(`/events/${id}`)).data,
  });

  function goTab(next: string): void {
    router.replace(`/admin/eventos/${id}/certificados?sub=${next}`);
  }

  const goPlantillas = (): void => goTab('plantillas');

  return (
    <div>
      <PageHeader
        titulo={`Certificados${event ? ` — ${event.title}` : ''}`}
        migas={[
          { etiqueta: 'Eventos', href: '/admin/eventos' },
          { etiqueta: event?.title ?? 'Evento', href: `/admin/eventos/${id}` },
          { etiqueta: 'Certificados' },
        ]}
        volverA={`/admin/eventos/${id}`}
      />
      <div className="mt-4">
        <Tabs tabs={TABS} activa={tab} onChange={goTab} />
      </div>
      <div className="mt-4">
        {tab === 'plantillas' ? <TemplateManager eventId={id} /> : null}
        {tab === 'asistentes' ? <AsistentesTab eventId={id} onGoTemplates={goPlantillas} /> : null}
        {tab === 'expositores' ? <ExpositoresTab eventId={id} /> : null}
        {tab === 'organizadores' ? <OrganizadoresTab eventId={id} /> : null}
        {tab === 'exportar' ? <AsistentesTab eventId={id} onGoTemplates={goPlantillas} /> : null}
      </div>
    </div>
  );
}
