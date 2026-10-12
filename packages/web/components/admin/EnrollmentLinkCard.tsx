'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CopyBroadcastButton } from '@/components/CopyBroadcastButton';

export function EnrollmentLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${site}/e/${slug}`;
  const qrPng = `${process.env.NEXT_PUBLIC_API_URL}/public/events/${slug}/link-qr.png`;

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  return (
    <section aria-label="Enlace de inscripción" className="rounded border border-[#C9A227] p-3">
      <h2 className="font-serif text-lg text-[#0A2A5E]">Enlace de inscripción</h2>
      <p className="mt-1 break-all text-sm">{url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-[44px] rounded bg-[#0A2A5E] px-3 py-2 text-sm text-white"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="min-h-[44px] rounded border px-3 py-2 text-sm"
        >
          Abrir
        </a>
        <CopyBroadcastButton slug={slug} />
      </div>
      <div className="mt-3">
        <p className="text-sm">QR del enlace (para afiches o proyección):</p>
        <img src={qrPng} alt="QR del enlace de inscripción" className="mt-1 w-40" />
        <div className="mt-2">
          <a href={qrPng} download={`qr-enlace-${slug}.png`} className="text-sm underline">
            Descargar QR
          </a>
        </div>
      </div>
    </section>
  );
}
