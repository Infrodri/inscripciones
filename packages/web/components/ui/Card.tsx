import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#D9DEE7] bg-white p-4 shadow-[0_1px_3px_rgb(16_34_68/0.12)]">
      {children}
    </section>
  );
}
