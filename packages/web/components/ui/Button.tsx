'use client';

import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primario' | 'secundario' | 'peligro' | 'fantasma';
type Size = 'sm' | 'md' | 'lg';

const styles: Record<Variant, string> = {
  primario:
    'bg-navy !text-white hover:bg-navy-hover hover:!text-white focus:!text-white active:!text-white visited:!text-white [&_a]:!text-white [&_a]:hover:!text-white [&_a]:focus:!text-white [&_*]:!text-white',
  secundario: 'border border-line bg-surface text-ink hover:border-navy [&_a]:text-ink',
  peligro:
    'bg-danger !text-white hover:opacity-90 hover:!text-white focus:!text-white active:!text-white visited:!text-white [&_a]:!text-white [&_a]:hover:!text-white [&_a]:focus:!text-white [&_*]:!text-white',
  fantasma: 'text-ink hover:bg-line [&_a]:text-ink',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 py-1 text-sm',
  md: 'min-h-[44px] px-4 py-2',
  lg: 'min-h-[52px] px-6 py-3 text-lg',
};

const base =
  'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 transition-colors cursor-pointer select-none no-underline';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  cargando?: boolean;
  children: ReactNode;
  asChild?: boolean;
}

export function Button({
  variant = 'primario',
  size = 'md',
  cargando = false,
  children,
  asChild = false,
  ...rest
}: Props) {
  const combinedClass = cn(
    base,
    styles[variant],
    sizes[size],
    rest.className,
    variant === 'primario' && '!text-white hover:!text-white focus:!text-white active:!text-white'
  );

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return cloneElement(child, {
      ...rest,
      className: cn(
        combinedClass,
        child.props.className,
        variant === 'primario' &&
          '!text-white hover:!text-white focus:!text-white active:!text-white visited:!text-white [&_*]:!text-white'
      ),
    });
  }

  return (
    <button
      type={rest.type ?? 'button'}
      disabled={rest.disabled ?? cargando}
      {...rest}
      className={combinedClass}
    >
      {cargando ? 'Cargando…' : children}
    </button>
  );
}
