'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/api';
import { formatCosto, formatFecha, formatModality, formatRangoSesion } from '@/lib/format';
import { Button } from '@/components/ui/Button';

export function CopyBroadcastButton({
  slug,
  size = 'md',
}: {
  slug: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy(): Promise<void> {
    try {
      const eventRes = await fetch(apiUrl(`/public/events/${slug}`));
      if (!eventRes.ok) {
        toast.error('No se pudo obtener la información del evento');
        return;
      }
      const event = (await eventRes.json()) as {
        title: string;
        location?: string | null;
        modality?: string | null;
        isFree?: boolean;
        cost?: number | null;
        sessions?: Array<{ startsAt: string; endsAt?: string | null }>;
      };

      const site = (
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL ?? '')
      ).replace(/\/+$/, '');
      const url = `${site}/e/${slug}`;

      let when = 'Por confirmar';
      const sessions = event.sessions ?? [];
      if (sessions.length === 1) {
        when = formatRangoSesion(sessions[0].startsAt, sessions[0].endsAt);
      } else if (sessions.length > 1) {
        const first = sessions[0];
        const last = sessions[sessions.length - 1];
        when = `${formatFecha(first.startsAt)} – ${formatFecha(last.startsAt)}`;
      }

      const venue =
        event.location?.trim() ||
        (event.modality ? formatModality(event.modality) : 'Por confirmar');

      const lines = [
        `📢 *${event.title.trim()}*`,
        '',
        `📅 *Fecha:* ${when}`,
        `📍 *Lugar:* ${venue}`,
      ];

      if (event.isFree !== undefined) {
        lines.push(`💰 *Inversión:* ${formatCosto(event.isFree, event.cost)}`);
      }

      lines.push('', `🔗 *Inscripción:*`, url);

      const text = lines.join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Mensaje de difusión copiado');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el mensaje de difusión');
    }
  }

  return (
    <Button variant="secundario" size={size} onClick={() => void copy()}>
      {copied ? '¡Copiado!' : 'Copiar mensaje de difusión'}
    </Button>
  );
}
