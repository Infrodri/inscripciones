'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primario' | 'secundario' | 'peligro';

const styles: Record<Variant, string> = {
  primario: 'bg-[#0A2A5E] text-white hover:bg-[#1F4E96]',
  secundario: 'border border-[#D9DEE7] bg-white text-[#1B2433] hover:border-[#0A2A5E]',
  peligro: 'bg-[#B42318] text-white hover:opacity-90',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  cargando?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primario', cargando = false, children, ...rest }: Props) {
  return (
    <button
      type={rest.type ?? 'button'}
      disabled={rest.disabled ?? cargando}
      {...rest}
      className={`min-h-[44px] rounded-[8px] px-4 py-2 text-white shadow-[0_1px_3px_rgb(16_34_68/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A227] disabled:opacity-50 ${styles[variant]} ${rest.className ?? ''}`}
    >
      {cargando ? 'Cargando…' : children}
    </button>
  );
}
