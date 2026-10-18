import type { ReactNode } from 'react';
import Link from 'next/link';
import { Providers } from '@/components/Providers';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-canvas text-ink">
        {/* USFX Institutional Header */}
        <header className="bg-navy border-b-2 border-gold text-white shadow-soft sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* University Identity */}
            <Link href="/" className="!text-white hover:opacity-95 transition-opacity flex items-center gap-3">
              <div className="h-11 w-11 rounded-full border-2 border-gold overflow-hidden shrink-0 shadow-soft bg-white/10">
                <img
                  src="/facultad-derecho-usfx.jpg"
                  alt="Facultad de Derecho USFX"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Universidad Mayor, Real y Pontificia
                </p>
                <p className="text-base sm:text-lg font-serif font-bold text-white tracking-tight">
                  San Francisco Xavier de Chuquisaca
                </p>
                <p className="text-[11px] text-white/70 hidden sm:block">
                  Facultad de Derecho, Ciencias Políticas y Sociales
                </p>
              </div>
            </Link>

            {/* Navigation & Access Button */}
            <div className="flex items-center gap-3 sm:gap-6">
              <nav aria-label="Navegación pública" className="hidden md:flex items-center gap-5 text-sm font-medium">
                <Link href="/" className="text-white hover:text-gold transition-colors">
                  Inicio
                </Link>
                <a href="#eventos" className="text-white/80 hover:text-white transition-colors">
                  Eventos
                </a>
                <a href="#verificar" className="text-white/80 hover:text-white transition-colors">
                  Verificar Certificado
                </a>
              </nav>

              {/* Botón de Acceso solicitado por el usuario */}
              <Link
                href="/admin/login"
                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] bg-gold px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-navy shadow-soft hover:bg-gold-hover transition-colors"
              >
                Acceder
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-surface text-xs text-muted py-8 mt-12">
          <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
            <nav
              aria-label="Enlaces académicos institucionales"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-ink font-medium"
            >
              <a
                href="https://usfx.bo"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-navy-hover transition-colors"
              >
                Portal USFX
              </a>
              <span className="text-line" aria-hidden="true">
                •
              </span>
              <a
                href="https://derecho.usfx.bo"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-navy-hover transition-colors"
              >
                Facultad de Derecho, Ciencias Políticas y Sociales
              </a>
              <span className="text-line" aria-hidden="true">
                •
              </span>
              <Link href="/admin/login" className="hover:text-navy-hover transition-colors">
                Acceso Administrativo
              </Link>
            </nav>
            <div className="space-y-1 text-muted">
              <p className="font-semibold text-ink">
                Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca
              </p>
              <p>Sucre - Bolivia • Fundada el 27 de Marzo de 1624</p>
              <p className="text-[11px] text-muted/70">
                Dirección de Tecnologías de Información y Comunicación (DTIC)
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Providers>
  );
}
