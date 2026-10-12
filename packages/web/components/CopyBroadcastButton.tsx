'use client';

import { useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Button } from '@/components/ui/Button';

export function CopyBroadcastButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy(): Promise<void> {
    const eventRes = await fetch(apiUrl(`/public/events/${slug}`));
    if (!eventRes.ok) return;
    const event = (await eventRes.json()) as {
      title: string;
      location: string;
      sessions: Array<{ startsAt: string }>;
    };
    const first = event.sessions[0];
    const when = first ? formatFechaHora(first.startsAt) : '';
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = `${site}/e/${slug}`;
    const text = `${event.title}\n${when}\n${event.location}\nInscripción: ${url}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secundario" onClick={() => void copy()}>
      {copied ? '¡Copiado!' : 'Copiar mensaje de difusión'}
    </Button>
  );
}
