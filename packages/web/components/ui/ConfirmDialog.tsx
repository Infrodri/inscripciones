'use client';

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
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-[8px] bg-white p-6 shadow-[0_1px_3px_rgb(16_34_68/0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl text-[#0A2A5E]">{titulo}</h2>
        <div className="mt-2 text-[#1B2433]">{mensaje}</div>
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
