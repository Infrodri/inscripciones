'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getToken } from '@/lib/api';

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // El login no exige sesión: redirigir login→login dejaba la pantalla
    // trabada en "Verificando sesión…".
    if (pathname.startsWith('/admin/login')) {
      if (getToken()) router.replace('/admin/eventos');
      else setReady(true);
      return;
    }
    if (!getToken()) router.replace('/admin/login');
    else setReady(true);
  }, [router, pathname]);

  if (!ready)
    return (
      <main className="p-8">
        <p>Verificando sesión…</p>
      </main>
    );
  return <>{children}</>;
}
