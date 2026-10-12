import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside>
        <nav>
          <a href="/admin/eventos">Eventos</a>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
