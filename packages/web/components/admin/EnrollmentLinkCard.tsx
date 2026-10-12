'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyBroadcastButton } from '@/components/CopyBroadcastButton';

export function EnrollmentLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${site}/e/${slug}`;
  const qrPng = apiUrl(`/public/events/${slug}/link-qr.png`);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  return (
    <Card>
      <h2 className="font-serif text-lg text-[#0A2A5E]">Enlace de inscripción</h2>
      <p className="mt-1 break-all text-sm">{url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[#D9DEE7] px-4 py-2"
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
    </Card>
  );
}
