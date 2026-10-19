'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { useBackdropClose } from './useBackdropClose';

export interface ConfirmDialogProps {
  open?: boolean;
  titulo: string;
  mensaje: React.ReactNode;
  confirmar?: string;
  onConfirmar: () => void;
  onCerrar: () => void;
  children?: React.ReactNode;
  cargando?: boolean;
  deshabilitado?: boolean;
  varianteConfirmar?: 'peligro' | 'primario' | 'secundario';
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (props.open !== true) return null;
  return <ConfirmDialogInner {...props} />;
}

function ConfirmDialogInner({
  open = true,
  titulo,
  mensaje,
  confirmar = 'Confirmar',
  onConfirmar,
  onCerrar,
  children,
  cargando = false,
  deshabilitado = false,
  varianteConfirmar = 'peligro',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const backdrop = useBackdropClose(onCerrar, !cargando);

  // Guardar el elemento que abrió el diálogo para restaurar foco
  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    // Pequeño delay para asegurar que el elemento trigger ya no esté focused
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  // Manejar ESC, focus trap y scroll lock
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cargando) return;
        e.preventDefault();
        onCerrar();
      }
    };

    // Focus trap con guardia contra recursión de foco
    const handleFocus = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      // Si el foco ya está dentro de este diálogo, no intervenir
      if (dialog.contains(e.target as Node)) return;

      // Guardia contra recursión / conflicto entre múltiples modales:
      // Si el elemento enfocado pertenece a otro diálogo o modal activo en el DOM, no pelear
      const targetElement = e.target as HTMLElement | null;
      if (
        targetElement?.closest?.('[role="dialog"]') ||
        targetElement?.closest?.('[role="alertdialog"]') ||
        targetElement?.closest?.('[aria-modal="true"]')
      ) {
        return;
      }

      // Si hay múltiples modales en el DOM y este no es el superior, no forzar foco
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (dialogs.length > 1 && dialogs[dialogs.length - 1] !== dialog) {
        return;
      }

      e.preventDefault();
      dialog.focus();
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
  }, [open, onCerrar, cargando]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-xs p-4"
      {...backdrop}
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
          <Button variant="secundario" onClick={onCerrar} disabled={cargando}>
            Cancelar
          </Button>
          {children ? (
            children
          ) : (
            <Button
              variant={varianteConfirmar}
              onClick={onConfirmar}
              cargando={cargando}
              disabled={deshabilitado || cargando}
            >
              {confirmar}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
