'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  CalendarDays,
  ScanLine,
  IdCard,
  Award,
  Users,
  ExternalLink,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { clearSession, getSessionUser } from '@/lib/auth';

interface NavItem {
  href: string;
  etiqueta: string;
  Icono: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
  external?: boolean;
}

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'GESTIÓN',
    items: [
      { href: '/admin/eventos', etiqueta: 'Eventos', Icono: CalendarDays },
      { href: '/admin/escaner', etiqueta: 'Acreditación y Puerta', Icono: ScanLine },
    ],
  },
  {
    title: 'EMISIÓN ACADÉMICA',
    items: [
      { href: '/admin/credenciales', etiqueta: 'Credenciales (Badges)', Icono: IdCard },
      { href: '/admin/certificados', etiqueta: 'Certificados y Diplomas', Icono: Award },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { href: '/admin/usuarios', etiqueta: 'Usuarios y Staff', Icono: Users, adminOnly: true },
    ],
  },
  {
    title: 'PORTAL',
    items: [
      { href: '/', etiqueta: 'Ver Portal Público', Icono: ExternalLink, external: true },
    ],
  },
];

export function AdminChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  const user = getSessionUser();
  const isAdmin = user?.role === 'ADMIN';

  function logout(): void {
    clearSession();
    setOpen(false);
    router.replace('/admin/login');
  }

  // Current page label for header
  let currentTitle = 'Administración';
  for (const sec of navSections) {
    for (const it of sec.items) {
      if (pathname === it.href || (it.href !== '/' && pathname.startsWith(`${it.href}/`))) {
        currentTitle = it.etiqueta;
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Mobile Backdrop */}
      {open ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy border-r-2 border-gold/40 text-white transition-transform md:sticky md:top-0 md:h-screen md:w-56 md:translate-x-0 md:overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* University Crest & Title */}
        <div className="p-4 border-b border-white/10 bg-navy-light/40">
          <Link href="/admin/eventos" className="block !text-white hover:opacity-95 transition-opacity">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
              U.M.R.P.S.F.X.CH.
            </p>
            <h1 className="font-serif text-base font-bold text-white leading-tight">
              San Francisco Xavier
            </h1>
            <p className="text-[11px] text-white/70 mt-0.5">
              Sistema de Eventos Académicos
            </p>
          </Link>
        </div>

        {/* Categorized Navigation */}
        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {navSections.map((sec) => {
            const filteredItems = sec.items.filter((it) => !it.adminOnly || isAdmin);
            if (filteredItems.length === 0) return null;

            return (
              <div key={sec.title} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-gold/80">
                  {sec.title}
                </p>
                {filteredItems.map(({ href, etiqueta, Icono, external }) => {
                  const activo =
                    href === '/'
                      ? pathname === '/'
                      : pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <Link
                      key={href}
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      aria-current={activo ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-[40px] items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition-colors ${
                        activo
                          ? 'bg-gold font-semibold text-navy shadow-soft'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icono size={17} className={activo ? 'text-navy' : 'text-gold'} />
                      <span className="truncate">{etiqueta}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Session Footer */}
        <div className="border-t border-white/10 p-3 bg-navy-light/30">
          {user ? (
            <div className="mb-2.5 px-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-gold uppercase">
                  {user.role === 'ADMIN' ? 'Administrador' : 'Organizador (Staff)'}
                </span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={logout}
            className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/15 transition-colors"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Desktop Top Header Bar ("Head de actividad") */}
        <header className="sticky top-0 z-20 hidden md:flex h-14 items-center justify-between border-b border-line bg-surface/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-navy text-base">{currentTitle}</span>
            <span className="text-muted/40">•</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API En Línea
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/eventos/nuevo"
              className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy-hover !text-white text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] transition-colors shadow-soft"
            >
              <PlusCircle size={15} />
              + Nuevo Evento
            </Link>

            {user ? (
              <div className="flex items-center gap-2 pl-3 border-l border-line text-xs">
                <div className="h-7 w-7 rounded-full bg-navy text-gold flex items-center justify-center font-bold font-serif text-xs border border-gold/40">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden lg:block leading-tight text-right">
                  <p className="font-semibold text-navy text-xs truncate max-w-[140px]">{user.name}</p>
                  <p className="text-[10px] text-muted">{user.role}</p>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {/* Mobile Header Bar */}
        <div className="flex md:hidden items-center justify-between border-b border-line bg-surface p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface text-ink px-2.5"
          >
            <Menu size={20} />
          </button>
          <span className="font-serif font-bold text-navy text-sm">{currentTitle}</span>
          <Link
            href="/admin/eventos/nuevo"
            className="inline-flex items-center justify-center h-8 px-2.5 bg-navy !text-white text-xs font-medium rounded-md"
          >
            + Evento
          </Link>
        </div>

        {/* Body Content */}
        <main className="mx-auto w-full max-w-6xl min-w-0 p-4 md:p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
