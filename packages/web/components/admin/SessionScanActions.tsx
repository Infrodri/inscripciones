'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { scanPath } from '@/lib/scanWindow';

export function SessionScanActions({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink(): Promise<void> {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    try {
      await navigator.clipboard.writeText(`${site}${scanPath(sessionId)}`);
      setCopied(true);
      toast.success('Enlace del escáner copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  return (
    <span className="flex flex-wrap gap-2">
      <Link
        href={scanPath(sessionId)}
        className="rounded bg-[#0A2A5E] px-2 py-1 text-sm text-white"
      >
        Abrir escáner
      </Link>
      <Link
        href={`${scanPath(sessionId)}/proyectar`}
        className="rounded border border-[#C9A227] px-2 py-1 text-sm"
      >
        Registro por QR (proyectar)
      </Link>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="rounded border px-2 py-1 text-sm"
      >
        {copied ? 'Copiado' : 'Copiar enlace del escáner'}
      </button>
    </span>
  );
}
