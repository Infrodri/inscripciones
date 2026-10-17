'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { formatFechaHora } from '@/lib/format';

export interface DateTimeInputProps {
  id?: string;
  name?: string;
  etiqueta?: string;
  error?: string;
  opcional?: string;
  value?: any;
  onChange?: (e: any) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export function DateTimeInput({
  id,
  name,
  etiqueta,
  error,
  opcional,
  value,
  onChange,
  disabled,
}: DateTimeInputProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Parse initial value (expected YYYY-MM-DDTHH:mm or ISO)
  const strVal = typeof value === 'string' ? value : '';
  const [datePart, setDatePart] = useState('');
  const [timePart, setTimePart] = useState('09:00');

  // Calendar navigation state
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (!strVal) {
      setDatePart('');
      return;
    }
    try {
      const d = new Date(strVal.includes('T') ? strVal : `${strVal}T00:00:00`);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const dd = pad(d.getDate());
        const mm = pad(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        setDatePart(`${dd}/${mm}/${yyyy}`);
        setTimePart(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
        setViewYear(yyyy);
        setViewMonth(d.getMonth());
      }
    } catch {
      // Ignorar fechas inválidas
    }
  }, [strVal]);

  // Cerrar calendario al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function emitValue(newDate: string, newTime: string) {
    if (!newDate.trim()) {
      onChange?.({ target: { value: '', id, name } });
      return;
    }
    // Formato esperado de fecha: DD/MM/AAAA
    const parts = newDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const time = newTime.trim() || '09:00';
      const isoLocal = `${year}-${month}-${day}T${time}`;
      onChange?.({ target: { value: isoLocal, id, name } });
    }
  }

  function handleDateInput(raw: string) {
    // Permitir escribir números y formatear automáticamente con barras
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length >= 3 && digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length >= 5) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    setDatePart(formatted);
    if (formatted.length === 10) {
      emitValue(formatted, timePart);
    }
  }

  function handleTimeInput(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length >= 3) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
    setTimePart(formatted);
    if (formatted.length === 5 && datePart.length === 10) {
      emitValue(datePart, formatted);
    }
  }

  function selectDay(day: number) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${pad(day)}/${pad(viewMonth + 1)}/${viewYear}`;
    setDatePart(formatted);
    emitValue(formatted, timePart);
    setShowCalendar(false);
  }

  function clearAll() {
    setDatePart('');
    setTimePart('09:00');
    onChange?.({ target: { value: '', id, name } });
    setShowCalendar(false);
  }

  function setToday() {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
    setDatePart(formatted);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    emitValue(formatted, timePart);
    setShowCalendar(false);
  }

  // Cálculos para la cuadrícula del mes en el calendario
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 es domingo
  const startDayIndex = (firstDayOfMonth + 6) % 7; // Convertir 0 a lunes (0=Lu, 6=Do)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Fecha ISO para preview natural
  let parsedIso: string | null = null;
  if (datePart.length === 10) {
    const p = datePart.split('/');
    if (p.length === 3) {
      parsedIso = `${p[2]}-${p[1]}-${p[0]}T${timePart || '09:00'}:00`;
    }
  }

  return (
    <div ref={containerRef} className="space-y-1">
      {etiqueta && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {etiqueta}
          {opcional && <span className="font-normal text-muted">{opcional}</span>}
        </label>
      )}

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        {/* Campo de Fecha boliviana DD/MM/AAAA */}
        <div className="relative flex-1 min-w-[150px]">
          <input
            id={id}
            type="text"
            placeholder="DD/MM/AAAA"
            value={datePart}
            onChange={(e) => handleDateInput(e.target.value)}
            disabled={disabled}
            className="w-full min-h-[44px] rounded-[var(--radius-md)] border border-line bg-surface p-2.5 pl-3 pr-10 text-ink shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink focus:outline-none"
            title="Abrir calendario boliviano"
            aria-label="Abrir calendario"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>

        {/* Campo de Hora boliviana 24 horas HH:mm */}
        <div className="relative w-36 min-w-[110px]">
          <input
            type="text"
            placeholder="HH:mm (24h)"
            value={timePart}
            onChange={(e) => handleTimeInput(e.target.value)}
            disabled={disabled}
            className="w-full min-h-[44px] rounded-[var(--radius-md)] border border-line bg-surface p-2.5 text-center text-ink shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 transition-colors"
          />
        </div>

        {/* Botón rápido para limpiar */}
        {(datePart || strVal) && !disabled && (
          <button
            type="button"
            onClick={clearAll}
            className="min-h-[44px] px-3 rounded-[var(--radius-md)] border border-line bg-surface text-muted hover:text-danger hover:border-danger text-xs font-medium transition-colors"
            title="Borrar fecha"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Popover del calendario interactivo en español */}
      {showCalendar && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(viewYear - 1);
                } else {
                  setViewMonth(viewMonth - 1);
                }
              }}
              className="p-1 rounded text-muted hover:text-ink hover:bg-canvas"
            >
              ◀
            </button>
            <span className="text-sm font-semibold text-navy">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(viewYear + 1);
                } else {
                  setViewMonth(viewMonth + 1);
                }
              }}
              className="p-1 rounded text-muted hover:text-ink hover:bg-canvas"
            >
              ▶
            </button>
          </div>

          {/* Días de la semana en español */}
          <div className="grid grid-cols-7 gap-1 pt-2 text-center text-xs font-bold text-muted">
            {DAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1 pt-1 text-center text-xs">
            {Array.from({ length: startDayIndex }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const pad = (n: number) => String(n).padStart(2, '0');
              const isSelected = datePart === `${pad(day)}/${pad(viewMonth + 1)}/${viewYear}`;
              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`h-7 w-7 mx-auto rounded-full transition-colors flex items-center justify-center font-medium ${
                    isSelected
                      ? 'bg-navy text-white font-bold'
                      : 'hover:bg-gold/20 text-ink'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Botones de acción del calendario */}
          <div className="mt-3 flex justify-between border-t border-line pt-2 text-xs">
            <button
              type="button"
              onClick={setToday}
              className="font-medium text-navy hover:underline"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="font-medium text-muted hover:text-ink"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Confirmación legible en español con formato boliviano */}
      {parsedIso && (
        <p className="text-xs text-muted flex items-center gap-1.5 pt-0.5">
          <span className="text-success font-bold">✓</span> {formatFechaHora(parsedIso)}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
