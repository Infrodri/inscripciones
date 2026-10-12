'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { clearSession, getSessionUser } from '@/lib/auth';

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
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-[#C9A227] bg-white p-4 transition-transform md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <p className="font-serif text-lg text-[#0A2A5E]">Administración</p>
        <nav className="mt-4 space-y-2">
          <Link
            href="/admin/eventos"
            onClick={() => setOpen(false)}
            className="block min-h-[44px] py-2"
          >
            Eventos
          </Link>
          <Link
            href="/admin/escaner"
            onClick={() => setOpen(false)}
            className="block min-h-[44px] py-2"
          >
            Escáner
          </Link>
          <Link
            href="/admin/usuarios"
            onClick={() => setOpen(false)}
            className="block min-h-[44px] py-2"
          >
            Usuarios
          </Link>
        </nav>
        <div className="mt-8 border-t pt-4 text-sm">
          {user ? (
            <p>
              {user.name} ({user.role})
            </p>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="mt-2 min-h-[44px] rounded border px-3 py-2"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="m-2 min-h-[44px] min-w-[44px] rounded border px-3 md:hidden"
        >
          ☰
        </button>
        <main className="min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
