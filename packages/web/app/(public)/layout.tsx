import type { ReactNode } from 'react';
import Link from 'next/link';
import { Providers } from '@/components/Providers';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="bg-navy border-b-2 border-gold text-white shadow-soft">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <Link href="/" className="!text-white hover:opacity-90 transition-opacity block">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                Universidad Mayor, Real y Pontificia
              </p>
              <p className="text-base sm:text-lg font-serif font-bold text-white leading-tight">
                San Francisco Xavier de Chuquisaca
              </p>
            </Link>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 border-surface/20 pt-2 sm:pt-0">
            <p className="text-xs sm:text-sm font-medium text-surface">
              Sistema de Inscripciones y Certificados Académicos
            </p>
            <p className="text-xs text-gold">
              Facultad de Derecho, Ciencias Políticas y Sociales
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface text-xs text-muted py-6">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-3">
          <nav aria-label="Enlaces académicos institucionales" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-ink">
            <a
              href="https://usfx.bo"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy-hover transition-colors"
            >
              Portal USFX
            </a>
            <span className="text-line" aria-hidden="true">•</span>
            <a
              href="https://derecho.usfx.bo"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy-hover transition-colors"
            >
              Facultad de Derecho
            </a>
            <span className="text-line" aria-hidden="true">•</span>
            <Link
              href="/"
              className="hover:text-navy-hover transition-colors"
            >
              Eventos Académicos
            </Link>
          </nav>
          <div className="space-y-1">
            <p className="font-medium text-ink">
              Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca
            </p>
            <p className="text-muted">
              Facultad de Derecho, Ciencias Políticas y Sociales • Sucre - Bolivia
            </p>
            <p className="text-muted text-[11px]">
              Sistema de Inscripciones y Certificados Académicos • Fundada en 1624
            </p>
          </div>
        </div>
      </footer>
    </div>
    </Providers>
  );
}

