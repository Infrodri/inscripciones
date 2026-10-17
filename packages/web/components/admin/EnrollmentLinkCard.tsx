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
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  return (
    <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft">
      <div className="grid gap-6 md:grid-cols-3 md:items-center">
        <div className="md:col-span-2 space-y-3">
          <div className="border-b border-line pb-2">
            <h2 className="font-serif text-lg font-bold text-navy">Enlace público de inscripción</h2>
            <p className="text-xs text-muted">Comparta este enlace o proyéctelo para que los participantes se registren.</p>
          </div>
          <div className="p-3 bg-canvas rounded-[var(--radius-md)] border border-line text-sm break-all font-mono text-ink select-all">
            {url}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primario" size="sm" onClick={() => void copy()} className="!text-white">
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button asChild variant="secundario" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                Abrir
              </a>
            </Button>
            <CopyBroadcastButton slug={slug} />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-canvas rounded-[var(--radius-md)] border border-line text-center space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">QR del enlace</span>
          <img
            src={qrPng}
            alt="QR del enlace de inscripción"
            className="w-32 h-32 object-contain bg-surface p-1.5 rounded-[var(--radius-md)] border border-line shadow-soft"
          />
          <a
            href={qrPng}
            download={`qr-enlace-${slug}.png`}
            className="inline-flex items-center text-xs text-navy hover:underline font-medium pt-1"
          >
            Descargar QR
          </a>
        </div>
      </div>
    </Card>
  );
}
