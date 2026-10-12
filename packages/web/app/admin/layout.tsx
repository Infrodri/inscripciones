import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminChrome } from '@/components/admin/AdminChrome';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AdminGuard>
        <AdminChrome>{children}</AdminChrome>
      </AdminGuard>
    </Providers>
  );
}
