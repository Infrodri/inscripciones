import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import { AdminChrome } from '@/components/admin/AdminChrome';

export default function ScanLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AdminChrome>{children}</AdminChrome>
    </Providers>
  );
}
