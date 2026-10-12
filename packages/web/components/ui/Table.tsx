import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[#D9DEE7]">
      <table className="w-full min-w-[560px] bg-white text-left text-sm">{children}</table>
    </div>
  );
}

export function PageHeader({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">{titulo}</h1>
      {accion}
    </div>
  );
}

export function EmptyState({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#D9DEE7] bg-white p-6 text-center">
      <p className="text-[#5B6677]">{mensaje}</p>
      {accion ? <div className="mt-3">{accion}</div> : null}
    </div>
  );
}
