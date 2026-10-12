import type { ReactNode } from 'react';

export default function ScanLayout({ children }: { children: ReactNode }) {
  return <main className="scan-fullscreen">{children}</main>;
}
