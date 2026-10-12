'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CalendarDays, LogOut, Menu, ScanLine, Users } from 'lucide-react';
import { clearSession, getSessionUser } from '@/lib/auth';

const items = [
  { href: '/admin/eventos', etiqueta: 'Eventos', Icono: CalendarDays },
  { href: '/admin/escaner', etiqueta: 'Escáner', Icono: ScanLine },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', Icono: Users },
];

export function AdminChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  const user = getSessionUser();

  function logout(): void {
    clearSession();
    setOpen(false);
    router.replace('/admin/login');
  }

  return (
    <div className="flex min-h-screen">
      {open ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0A2A5E] p-4 text-white transition-transform md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <p className="font-serif text-lg">Administración</p>
        <nav className="mt-4 space-y-1">
          {items.map(({ href, etiqueta, Icono }) => {
            const activo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2 ${
                  activo ? 'bg-[#C9A227] font-medium text-[#0A2A5E]' : 'hover:bg-[#1F4E96]'
                }`}
              >
                <Icono size={20} aria-hidden />
                {etiqueta}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/20 pt-4 text-sm">
          {user ? (
            <p>
              {user.name} ({user.role})
            </p>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex min-h-[44px] items-center gap-2 rounded-[8px] border border-white/30 px-3 py-2"
          >
            <LogOut size={18} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[#D9DEE7] bg-white px-3 md:hidden"
        >
          <Menu size={22} aria-hidden />
        </button>
        <main className="mx-auto w-full max-w-5xl min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
