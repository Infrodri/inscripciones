'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useBackdropClose } from './useBackdropClose';

// Dialog accesible: trampa de foco, Esc, clic fuera, botón cerrar visible,
// ancho máximo en móvil sin desborde.
export function Dialog({
  titulo,
  onCerrar,
  children,
  accion,
  maxWidth = 'max-w-lg',
  open = true,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  accion?: ReactNode;
  maxWidth?: string;
  open?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const backdrop = useBackdropClose(onCerrar);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return;

    // Solo enfocar inicialmente si el foco actual no está ya dentro del diálogo
    if (!panel.contains(document.activeElement)) {
      const inputs = Array.from(
        panel.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea')
      ).filter((el) => !el.hasAttribute('disabled'));

      if (inputs.length > 0) {
        inputs[0].focus();
      } else {
        const otherFocusables = Array.from(
          panel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.hasAttribute('disabled'));
        otherFocusables[0]?.focus();
      }
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCerrarRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-xs p-4"
      {...backdrop}
    >
      <div
        ref={panelRef}
        className={`max-h-[85vh] w-full ${maxWidth} overflow-y-auto rounded-[var(--radius-md)] bg-surface border border-line p-6 shadow-soft`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
          <h2 className="font-serif text-xl font-bold text-navy">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] border border-line text-muted hover:text-ink hover:bg-canvas transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 text-ink">{children}</div>
        {accion ? <div className="mt-4 flex justify-end gap-2">{accion}</div> : null}
      </div>
    </div>
  );
}

export function useUnsavedChanges(sucio: boolean): void {
  useEffect(() => {
    if (!sucio) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sucio]);
}
