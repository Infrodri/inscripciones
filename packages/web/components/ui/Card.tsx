import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-md)] border border-line bg-surface shadow-soft p-4',
        className
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
