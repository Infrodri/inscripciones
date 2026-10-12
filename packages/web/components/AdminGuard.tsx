'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getToken } from '@/lib/api';

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/admin/login');
    else setReady(true);
  }, [router]);

  if (!ready)
    return (
      <main className="p-8">
        <p>Verificando sesión…</p>
      </main>
    );
  return <>{children}</>;
}
