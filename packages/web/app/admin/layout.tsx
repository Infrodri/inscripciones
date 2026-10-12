import type { ReactNode } from 'react';
import Link from 'next/link';
import { Providers } from '@/components/Providers';
import { AdminGuard } from '@/components/AdminGuard';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AdminGuard>
        <div className="flex min-h-screen">
          <aside className="w-56 border-r border-[#C9A227] p-4">
            <p className="font-serif text-lg text-[#0A2A5E]">Administración</p>
            <nav className="mt-4 space-y-2">
              <Link href="/admin/eventos" className="block">
                Eventos
              </Link>
              <Link href="/admin/usuarios" className="block">
                Usuarios
              </Link>
            </nav>
          </aside>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </AdminGuard>
    </Providers>
  );
}
