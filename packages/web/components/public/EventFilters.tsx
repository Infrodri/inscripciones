'use client';

import { Search, X, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface EventFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedKind: string;
  onKindChange: (kind: string) => void;
  availableKinds: string[];
  selectedModality: string;
  onModalityChange: (modality: string) => void;
  onClearFilters: () => void;
  totalFiltered: number;
}

export function EventFilters({
  search,
  onSearchChange,
  selectedKind,
  onKindChange,
  availableKinds,
  selectedModality,
  onModalityChange,
  onClearFilters,
  totalFiltered,
}: EventFiltersProps) {
  const hasActiveFilters =
    search.trim() !== '' || selectedKind !== 'TODOS' || selectedModality !== 'TODAS';

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Search Bar & Modality */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Input
            id="event-search-input"
            etiqueta="Buscar eventos"
            placeholder="Buscar por título, temática, expositor o carrera…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 min-h-[44px]"
          />
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
            aria-hidden="true"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink min-h-[32px] min-w-[32px] flex items-center justify-center rounded"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="sm:w-56 shrink-0">
          <label htmlFor="modality-select" className="sr-only">
            Filtrar por modalidad
          </label>
          <select
            id="modality-select"
            value={selectedModality}
            onChange={(e) => onModalityChange(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
          >
            <option value="TODAS">Todas las modalidades</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="VIRTUAL">Virtual</option>
            <option value="HIBRIDO">Híbrido</option>
          </select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="fantasma"
            onClick={onClearFilters}
            className="min-h-[44px] text-xs text-muted hover:text-ink shrink-0"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Tipos de eventos"
        >
          {availableKinds.map((kind) => {
            const isSelected = selectedKind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onKindChange(kind)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] transition-all ${
                  isSelected
                    ? 'bg-navy text-white shadow-soft font-bold'
                    : 'bg-surface text-muted hover:text-ink hover:bg-canvas border border-line'
                }`}
              >
                {kind}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-muted font-medium self-center">
          {totalFiltered} {totalFiltered === 1 ? 'evento encontrado' : 'eventos encontrados'}
        </span>
      </div>
    </div>
  );
}
