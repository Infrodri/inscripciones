'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function ConfirmDialog({
  titulo,
  mensaje,
  confirmar = 'Confirmar',
  onConfirmar,
  onCerrar,
  children,
}: {
  titulo: string;
  mensaje: React.ReactNode;
  confirmar?: string;
  onConfirmar: () => void;
  onCerrar: () => void;
  children?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Guardar el elemento que abrió el diálogo para restaurar foco
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    // Pequeño delay para asegurar que el elemento trigger ya no esté focused
    setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);
  }, []);

  // Manejar ESC, focus trap y scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCerrar();
      }
    };

    // Focus trap
    const handleFocus = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(e.target as Node)) {
        e.preventDefault();
        dialog.focus();
      }
    };

    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focus', handleFocus, true);
      // Restaurar foco al elemento que abrió el diálogo
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [onCerrar]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onCerrar}
      tabIndex={-1}
      ref={dialogRef}
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-md)] bg-surface p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl text-ink">{titulo}</h2>
        <div className="mt-2 text-ink">{mensaje}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          {children ? (
            children
          ) : (
            <Button variant="peligro" onClick={onConfirmar}>
              {confirmar}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}