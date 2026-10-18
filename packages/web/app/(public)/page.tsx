'use client';

import { useState, useDeferredValue, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PublicEvent } from '@/lib/types';
import { normalizeText } from '@/lib/format';
import { HeroSection } from '@/components/public/HeroSection';
import { CertificateLookup } from '@/components/public/CertificateLookup';
import { EventFilters } from '@/components/public/EventFilters';
import { EventCard } from '@/components/public/EventCard';
import { EventCardSkeleton, EmptyState, ErrorState } from '@/components/ui/StateViews';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedKind, setSelectedKind] = useState('TODOS');
  const [selectedModality, setSelectedModality] = useState('TODAS');

  const eventsSectionRef = useRef<HTMLDivElement>(null);
  const verifySectionRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-events'],
    queryFn: async (): Promise<PublicEvent[]> => {
      const res = await api.get('/public/events');
      return (res.data?.data ?? []) as PublicEvent[];
    },
    staleTime: 60_000,
  });

  const events = data ?? [];

  // Extract distinct event kinds for filtering
  const availableKinds = useMemo(() => {
    const rawKinds = Array.from(new Set(events.map((e) => e.eventKind).filter(Boolean)));
    return ['TODOS', ...rawKinds.sort()];
  }, [events]);

  // Accent-insensitive filtered events
  const filteredEvents = useMemo(() => {
    const normQuery = normalizeText(deferredSearch);

    return events.filter((ev) => {
      // 1. Kind filter
      if (selectedKind !== 'TODOS' && ev.eventKind !== selectedKind) {
        return false;
      }

      // 2. Modality filter
      if (selectedModality !== 'TODAS' && ev.modality !== selectedModality) {
        return false;
      }

      // 3. Normalized text search over title, kind, institution, organizer, description
      if (normQuery) {
        const titleNorm = normalizeText(ev.title);
        const kindNorm = normalizeText(ev.eventKind);
        const instNorm = normalizeText(ev.institution);
        const orgNorm = normalizeText(ev.organizer);
        const descNorm = normalizeText(ev.description);

        const matches =
          titleNorm.includes(normQuery) ||
          kindNorm.includes(normQuery) ||
          instNorm.includes(normQuery) ||
          orgNorm.includes(normQuery) ||
          descNorm.includes(normQuery);

        if (!matches) return false;
      }

      return true;
    });
  }, [events, deferredSearch, selectedKind, selectedModality]);

  function handleClearFilters() {
    setSearch('');
    setSelectedKind('TODOS');
    setSelectedModality('TODAS');
  }

  function scrollToEvents() {
    eventsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToVerify() {
    verifySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Section */}
      <HeroSection onScrollToEvents={scrollToEvents} onScrollToVerify={scrollToVerify} />

      {/* 2. Public Certificate Verification Widget */}
      <div ref={verifySectionRef} className="px-4">
        <CertificateLookup />
      </div>

      {/* 3. Academic Events Catalog */}
      <div ref={eventsSectionRef} className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Próximos Eventos y Convocatorias
          </h2>
          <p className="text-sm text-muted">
            Explore los programas académicos abiertos a la comunidad universitaria y público en
            general.
          </p>
        </div>

        {/* Filters */}
        <EventFilters
          search={search}
          onSearchChange={setSearch}
          selectedKind={selectedKind}
          onKindChange={setSelectedKind}
          availableKinds={availableKinds}
          selectedModality={selectedModality}
          onModalityChange={setSelectedModality}
          onClearFilters={handleClearFilters}
          totalFiltered={filteredEvents.length}
        />

        {/* Events Grid or States */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Error al cargar los eventos"
            description="No se pudieron recuperar los eventos académicos disponibles en este momento."
            onRetry={() => void refetch()}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="No hay eventos programados"
            description="Actualmente no hay eventos académicos publicados. Vuelva a consultar más adelante o comuníquese con su facultad."
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No se encontraron eventos coincidentes"
            description="No hay eventos que cumplan con los términos o filtros seleccionados. Intente ajustar los criterios de búsqueda."
            actionLabel="Limpiar filtros"
            onAction={handleClearFilters}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
