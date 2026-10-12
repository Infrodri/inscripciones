'use client';

import { useState } from 'react';

export function CopyBroadcastButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    const eventRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/events/${slug}`);
    if (!eventRes.ok) return;
    const event = (await eventRes.json()) as {
      title: string;
      location: string;
      sessions: Array<{ startsAt: string }>;
    };
    const first = event.sessions[0];
    const when = first
      ? new Date(first.startsAt).toLocaleString('es-BO', {
          timeZone: 'America/La_Paz',
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : '';
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = `${site}/e/${slug}`;
    const text = `${event.title}\n${when}\n${event.location}\nInscripción: ${url}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded border border-[#C9A227] px-4 py-2"
    >
      {copied ? 'Mensaje copiado' : 'Copiar mensaje de difusión'}
    </button>
  );
}
