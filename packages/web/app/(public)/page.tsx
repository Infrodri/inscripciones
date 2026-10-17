'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface PublicEvent {
  slug: string;
  title: string;
  eventKind: string;
  institution: string;
  commemoration?: string | null;
  organizer: string;
  location: string;
  modality: 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDO';
  capacity?: number | null;
  status: 'BORRADOR' | 'ABIERTO' | 'CERRADO' | 'FINALIZADO';
  isFree: boolean;
  cost?: number | null;
  bannerUrl?: string | null;
  registrationOpen: boolean;
  registrationReason?: string | null;
  sessions?: Array<{ startsAt: string; location?: string | null; label?: string | null }>;
}

export default function PublicEventsHomePage() {
  const [search, setSearch] = useState('');
  const [selectedKind, setSelectedKind] = useState('TODOS');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-events'],
    queryFn: async (): Promise<{ data: PublicEvent[] }> => {
      const res = await api.get('/public/events');
      return res.data;
    },
  });

  const events = data?.data ?? [];

  // Extract unique event kinds
  const kinds = useMemo(() => {
    const list = Array.from(new Set(events.map((e) => e.eventKind).filter(Boolean)));
    return ['TODOS', ...list];
  }, [events]);

  // Filter events
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return events.filter((e) => {
      const matchesSearch =
        q === '' ||
        e.title.toLowerCase().includes(q) ||
        e.organizer.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        (e.commemoration && e.commemoration.toLowerCase().includes(q));
      const matchesKind = selectedKind === 'TODOS' || e.eventKind === selectedKind;
      return matchesSearch && matchesKind;
    });
  }, [events, search, selectedKind]);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <section className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-navy/10 text-navy">
          <span className="h-2 w-2 rounded-full bg-gold" />
          Cartelera Académica Oficial
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-navy tracking-tight">
          Congresos, Conferencias y Eventos
        </h1>
        <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto">
          Participe en los eventos académicos, simposios y jornadas formativas organizadas por la Universidad San Francisco Xavier de Chuquisaca.
        </p>
      </section>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="max-w-xl mx-auto">
          <Input
            id="search-events"
            etiqueta="Buscar eventos"
            placeholder="Buscar por título, temática, expositor o lugar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {kinds.length > 2 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKind(k)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedKind === k
                    ? 'bg-navy !text-white shadow-soft'
                    : 'bg-surface text-muted border border-line hover:bg-canvas hover:text-ink'
                }`}
              >
                {k === 'TODOS' ? 'Todos los eventos' : k}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="py-16 text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
          <p className="text-muted text-sm">Cargando eventos académicos…</p>
        </div>
      ) : isError ? (
        <Card className="p-8 text-center border-danger/30 bg-danger/5 rounded-xl">
          <p className="text-danger font-medium">{apiErrorMessage(error)}</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="py-16 px-4 text-center border-line bg-surface rounded-xl space-y-3 shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-ink font-semibold">No se encontraron eventos</p>
          <p className="text-sm text-muted max-w-sm mx-auto">
            {search.trim() || selectedKind !== 'TODOS'
              ? 'Intente modificar los términos de búsqueda o filtros.'
              : 'Próximamente se publicarán nuevos congresos y seminarios.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const firstSession = e.sessions?.[0];
            return (
              <Card
                key={e.slug}
                className="flex flex-col justify-between overflow-hidden border border-line bg-surface rounded-xl shadow-soft hover:shadow-md transition-shadow group"
              >
                {/* Banner or Institutional Header */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-navy/90 flex items-center justify-center">
                  {e.bannerUrl ? (
                    <img
                      src={e.bannerUrl}
                      alt={e.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-1">
                      <p className="text-xs uppercase tracking-wider text-gold font-semibold">USFX</p>
                      <p className="text-sm text-white/90 font-serif font-bold line-clamp-2 px-2">
                        {e.title}
                      </p>
                    </div>
                  )}
                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-navy/90 text-white shadow-soft">
                      {e.eventKind}
                    </span>
                    <Badge tono={e.status}>{e.status}</Badge>
                  </div>
                </div>

                {/* Event Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-serif text-lg font-bold text-navy leading-snug line-clamp-2 group-hover:text-navy-hover transition-colors">
                      <Link href={`/e/${e.slug}`}>{e.title}</Link>
                    </h3>
                    <p className="text-xs text-muted line-clamp-1">
                      {e.organizer}
                    </p>

                    <div className="pt-2 border-t border-line space-y-1.5 text-xs text-ink/80">
                      {firstSession && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted">📅</span>
                          <span>{formatFechaHora(firstSession.startsAt)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-muted">📍</span>
                        <span className="line-clamp-1">{e.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted">🏛️</span>
                        <span>{e.modality}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="pt-3 border-t border-line flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-muted block">Costo</span>
                      <span className="text-sm font-bold text-navy">
                        {e.isFree ? 'Gratuito' : `Bs. ${Number(e.cost).toFixed(2)}`}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/e/${e.slug}`}
                        className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
                      >
                        Detalles
                      </Link>
                      {e.registrationOpen && (
                        <Link
                          href={`/e/${e.slug}/inscripcion`}
                          className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] bg-navy px-3.5 py-1.5 text-xs font-semibold !text-white shadow-soft hover:bg-navy-hover transition-colors"
                        >
                          Inscribirme
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Admin Access Link */}
      <div className="pt-8 text-center border-t border-line">
        <Link
          href="/admin/login"
          className="text-xs text-muted hover:text-navy underline transition-colors"
        >
          Acceso administrativo y panel de organizadores
        </Link>
      </div>
    </div>
  );
}
