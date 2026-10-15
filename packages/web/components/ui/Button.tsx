'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primario' | 'secundario' | 'peligro' | 'fantasma';
type Size = 'sm' | 'md' | 'lg';

const styles: Record<Variant, string> = {
  primario: 'bg-navy text-white hover:bg-navy-hover',
  secundario: 'border border-line bg-surface text-ink hover:border-navy',
  peligro: 'bg-danger text-white hover:opacity-90',
  fantasma: 'text-ink hover:bg-line',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 py-1 text-sm',
  md: 'min-h-[44px] px-4 py-2',
  lg: 'min-h-[52px] px-6 py-3 text-lg',
};

const base = 'rounded-[var(--radius-md)] shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  cargando?: boolean;
  children: ReactNode;
  asChild?: boolean;
}

export function Button({ variant = 'primario', size = 'md', cargando = false, children, asChild = false, ...rest }: Props) {
  const Comp = asChild ? 'span' : 'button';
  return (
    <Comp
      {...(asChild ? {} : { type: rest.type ?? 'button', disabled: rest.disabled ?? cargando })}
      {...rest}
      className={cn(base, styles[variant], sizes[size], rest.className)}
    >
      {cargando ? 'Cargando…' : children}
    </Comp>
  );
}
