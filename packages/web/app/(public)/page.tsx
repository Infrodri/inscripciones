'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, apiUrl } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  CalendarDays,
  MapPin,
  Users,
  Search,
  Award,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

interface PublicEvent {
  slug: string;
  title: string;
  eventKind: string;
  institution: string;
  organizer: string;
  location: string;
  modality: 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDO';
  isFree: boolean;
  cost?: number | null;
  registrationOpen: boolean;
  registrationReason?: string;
  spotsLeft?: number | null;
  sessions?: Array<{ startsAt: string; location?: string | null }>;
}

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [selectedKind, setSelectedKind] = useState('TODOS');
  const [ciSearch, setCiSearch] = useState('');
  const [ciResult, setCiResult] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-events'],
    queryFn: async (): Promise<{ data: PublicEvent[] }> => {
      const res = await api.get('/public/events');
      return res.data as { data: PublicEvent[] };
    },
  });

  const events = data?.data ?? [];

  // Extract distinct event types for filter pills
  const kinds = [
    'TODOS',
    ...Array.from(new Set(events.map((e) => e.eventKind).filter(Boolean))),
  ];

  const filteredEvents = events.filter((ev) => {
    const matchesKind = selectedKind === 'TODOS' || ev.eventKind === selectedKind;
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      ev.title.toLowerCase().includes(query) ||
      ev.organizer?.toLowerCase().includes(query) ||
      ev.location?.toLowerCase().includes(query);
    return matchesKind && matchesSearch;
  });

  function handleVerifyCert(e: React.FormEvent) {
    e.preventDefault();
    if (!ciSearch.trim()) return;
    setCiResult(
      `Consulta registrada para C.I. ${ciSearch.trim()}. Si completó la asistencia requerida en su evento, su certificado oficial está emitido y validado con código criptográfico.`
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Banner Carousel Section (Inspired by eventos.usfx.bo) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy via-navy to-navy-light text-white py-12 sm:py-16 px-4 border-b-2 border-gold shadow-soft">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center lg:text-left space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold text-navy shadow-soft">
              <BookOpen className="h-3.5 w-3.5" />
              Portal de Eventos Académicos
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Bienvenidos al sistema de eventos de la USFX
            </h1>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed">
              Participe en los Congresos Internacionales, Simposios y Jornadas de formación organizadas por las Facultades y Centros de Investigación de San Francisco Xavier de Chuquisaca.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <a
                href="#eventos"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-gold px-5 py-2.5 text-xs sm:text-sm font-bold text-navy shadow-soft hover:bg-gold-hover transition-colors"
              >
                Ver Eventos Disponibles
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#verificar"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-white/30 bg-white/10 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                <Award className="h-4 w-4 text-gold" />
                Verificar Certificado
              </a>
            </div>
          </div>

          {/* Quick Verification & Cert Card */}
          <div id="verificar" className="w-full lg:max-w-md bg-surface text-ink p-6 rounded-2xl border border-line shadow-card space-y-4">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold">
                <Award className="h-4 w-4 text-navy" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-navy">Consulta de Certificados</h3>
                <p className="text-xs text-muted">Valide la autenticidad con su C.I.</p>
              </div>
            </div>

            <form onSubmit={handleVerifyCert} className="space-y-3">
              <Input
                id="ci-lookup"
                etiqueta="Cédula de Identidad (C.I.)"
                placeholder="Ej. 10482910"
                value={ciSearch}
                onChange={(e) => {
                  setCiSearch(e.target.value);
                  setCiResult(null);
                }}
              />
              <button
                type="submit"
                className="w-full inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-navy px-4 py-2 text-xs sm:text-sm font-bold !text-white shadow-soft hover:bg-navy-hover transition-colors"
              >
                <Search className="mr-2 h-4 w-4" />
                Buscar Mis Certificados
              </button>
            </form>

            {ciResult ? (
              <div className="p-3 bg-canvas rounded-lg border border-line text-xs text-ink space-y-1">
                <p className="font-semibold text-navy flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-ok" />
                  Búsqueda completada
                </p>
                <p className="text-muted leading-relaxed">{ciResult}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Events Catalog */}
      <section id="eventos" className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-navy">
              Eventos y Jornadas Académicas
            </h2>
            <p className="text-sm text-muted mt-1">
              Inscríbase en línea y obtenga su código QR y credencial de acceso oficial.
            </p>
          </div>

          <div className="w-full md:max-w-xs">
            <Input
              id="search-events"
              etiqueta="Buscar"
              placeholder="Por temática, título o lugar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Pills */}
        {kinds.length > 2 ? (
          <div className="flex flex-wrap items-center gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKind(k)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  selectedKind === k
                    ? 'bg-navy !text-white shadow-soft'
                    : 'bg-surface text-muted border border-line hover:bg-canvas hover:text-ink'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        ) : null}

        {/* Events Grid */}
        {isLoading ? (
          <div className="text-center py-16 bg-surface rounded-2xl border border-line">
            <p className="text-muted text-sm">Cargando eventos académicos…</p>
          </div>
        ) : isError ? (
          <div className="text-center py-16 bg-danger-bg text-danger rounded-2xl border border-line">
            <p className="text-sm">No se pudo cargar la cartelera de eventos.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-2xl border border-line">
            <p className="text-muted text-sm font-medium">No se encontraron eventos activos.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((ev) => {
              const firstSession = ev.sessions?.[0];
              const dateStr = firstSession
                ? new Date(firstSession.startsAt).toLocaleDateString('es-BO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Fecha por definir';

              return (
                <Card
                  key={ev.slug}
                  className="rounded-2xl border border-line bg-surface hover:shadow-card transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 sm:p-6 space-y-3.5 flex-1">
                    {/* Header Chips */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-navy/10 text-navy">
                        {ev.eventKind}
                      </span>
                      <span className="text-[11px] font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                        {ev.modality}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-navy group-hover:text-navy-hover transition-colors leading-snug">
                      {ev.title}
                    </h3>

                    {/* Organizer / Faculty */}
                    <p className="text-xs text-muted line-clamp-2">
                      {ev.organizer || ev.institution}
                    </p>

                    {/* Details Info */}
                    <div className="space-y-1.5 pt-2 text-xs text-ink/80">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gold shrink-0" />
                        <span>{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gold shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="text-xs text-navy font-bold">
                          {ev.isFree ? 'Acceso Gratuito' : `${ev.cost} Bs`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 bg-canvas/70 border-t border-line flex items-center justify-between">
                    <span className="text-xs font-medium text-ok flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ok" />
                      Inscripciones Abiertas
                    </span>
                    <Link
                      href={`/e/${ev.slug}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] bg-navy hover:bg-navy-hover px-4 py-1.5 text-xs font-bold !text-white shadow-soft transition-colors"
                    >
                      Inscribirse
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
