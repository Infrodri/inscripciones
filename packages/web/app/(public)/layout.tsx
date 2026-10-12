import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header>
        <p>Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca</p>
      </header>
      <main>{children}</main>
      <footer>
        <p>Facultad de Derecho, Ciencias Políticas y Sociales</p>
      </footer>
    </>
  );
}
