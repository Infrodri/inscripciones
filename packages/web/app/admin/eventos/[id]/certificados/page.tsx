'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TemplateManager } from '@/components/admin/TemplateManager';
import { AsistentesTab } from '@/components/admin/AsistentesTab';
import { ExpositoresTab } from '@/components/admin/ExpositoresTab';
import { OrganizadoresTab } from '@/components/admin/OrganizadoresTab';

const TABS = ['Plantillas', 'Asistentes', 'Expositores', 'Organizadores', 'Exportar'] as const;

export default function CertificadosPage({ params }: { params: Promise<{ id: string }> }) {
  return <Tabs params={params} />;
}

function Tabs({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Plantillas');
  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: async (): Promise<{ slug: string; title: string }> =>
      (await api.get(`/events/${id}`)).data,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-[#0A2A5E]">
        Certificados{event ? ` — ${event.title}` : ''}
      </h1>
      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded border px-3 py-1 ${tab === t ? 'bg-[#0A2A5E] text-white' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'Plantillas' ? <TemplateManager eventId={id} /> : null}
        {tab === 'Asistentes' ? (
          <AsistentesTab eventId={id} onGoTemplates={() => setTab('Plantillas')} />
        ) : null}
        {tab === 'Expositores' ? <ExpositoresTab eventId={id} /> : null}
        {tab === 'Organizadores' ? <OrganizadoresTab eventId={id} /> : null}
        {tab === 'Exportar' ? (
          <AsistentesTab eventId={id} onGoTemplates={() => setTab('Plantillas')} />
        ) : null}
      </div>
    </div>
  );
}
