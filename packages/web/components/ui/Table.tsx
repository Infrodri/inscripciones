'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[#D9DEE7]">
      <table className="w-full min-w-[560px] bg-white text-left text-sm">{children}</table>
    </div>
  );
}

export interface Miga {
  etiqueta: string;
  href?: string;
}

export function PageHeader({
  titulo,
  accion,
  migas,
  volverA,
}: {
  titulo: string;
  accion?: ReactNode;
  migas?: Miga[];
  volverA?: string;
}) {
  const router = useRouter();

  function volver(): void {
    const ref = document.referrer;
    if (ref) {
      try {
        if (new URL(ref).origin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // Referrer inválido: se usa el fallback.
      }
    }
    router.replace(volverA ?? '/admin/eventos');
  }

  return (
    <div>
      {migas && migas.length > 0 ? (
        <nav aria-label="Migas de pan" className="text-sm text-[#5B6677]">
          {migas.map((miga, index) => (
            <span key={miga.etiqueta}>
              {index > 0 ? ' › ' : null}
              {miga.href ? (
                <a href={miga.href} className="underline">
                  {miga.etiqueta}
                </a>
              ) : (
                <span aria-current="page">{miga.etiqueta}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={volver}
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[#D9DEE7] bg-white px-3 py-2"
        >
          ← Volver
        </button>
        <h1 className="font-serif text-2xl text-[#0A2A5E]">{titulo}</h1>
        {accion}
      </div>
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
