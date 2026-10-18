'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export function Table({
  children,
  minWidth = 'min-w-[1020px]',
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface shadow-soft">
      <table
        className={`w-full ${minWidth} bg-surface text-left text-sm [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_th]:bg-canvas/70 [&_th]:border-b [&_th]:border-line [&_th]:whitespace-nowrap [&_td]:px-3.5 [&_td]:py-3 [&_td]:text-sm [&_td]:text-ink [&_td]:border-b [&_td]:border-line/60 [&_td]:align-middle [&_tbody_tr]:hover:bg-canvas/40 [&_tbody_tr]:transition-colors`}
      >
        {children}
      </table>
    </div>
  );
}

export interface Miga {
  etiqueta: string;
  href?: string;
}

export function PageHeader({
  titulo,
  descripcion,
  accion,
  migas,
  volverA,
}: {
  titulo: string;
  descripcion?: string;
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
        <nav aria-label="Migas de pan" className="text-sm text-muted">
          {migas.map((miga, index) => (
            <span key={miga.etiqueta}>
              {index > 0 ? ' › ' : null}
              {miga.href ? (
                <a href={miga.href} className="underline hover:text-navy">
                  {miga.etiqueta}
                </a>
              ) : (
                <span aria-current="page" className="text-ink font-medium">
                  {miga.etiqueta}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={volver}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-line bg-surface text-ink px-3 py-2 text-sm hover:bg-canvas transition-colors"
        >
          ← Volver
        </button>
        <h1 className="font-serif text-2xl text-navy">{titulo}</h1>
        {accion}
      </div>
      {descripcion ? <p className="mt-1 text-sm text-muted">{descripcion}</p> : null}
    </div>
  );
}

export function EmptyState({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-line bg-surface p-6 text-center">
      <p className="text-muted">{mensaje}</p>
      {accion ? <div className="mt-3">{accion}</div> : null}
    </div>
  );
}
