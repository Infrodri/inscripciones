'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Dialog accesible: trampa de foco, Esc, clic fuera, botón cerrar visible,
// ancho máximo en móvil sin desborde.
export function Dialog({
  titulo,
  onCerrar,
  children,
  accion,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  accion?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusables = (): HTMLElement[] =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusables();
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
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        ref={panelRef}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[8px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-xl text-[#0A2A5E]">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[#D9DEE7]"
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
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
