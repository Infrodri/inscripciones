'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export function EventBanner({ eventId, slug }: { eventId: string; slug: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ['public-event', slug],
    queryFn: async (): Promise<{ bannerUrl: string | null }> =>
      (await api.get(`/public/events/${slug}`)).data,
  });

  async function upload(): Promise<void> {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('banner', file);
      await api.post(`/events/${eventId}/banner`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['public-event', slug] });
      toast.success('Afiche subido');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="afiche" aria-label="Afiche">
      <h2 className="font-serif text-lg text-[#0A2A5E]">Afiche</h2>
      {data?.bannerUrl ? (
        <img
          src={data.bannerUrl}
          alt="Afiche del evento"
          className="mt-2 max-h-64 rounded border"
        />
      ) : (
        <p className="mt-2 text-sm">
          Sin afiche: la página pública muestra el encabezado institucional.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label="Archivo del afiche"
          className="max-w-full"
        />
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!file || busy}
          className="min-h-[44px] rounded bg-[#0A2A5E] px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Subiendo…' : 'Subir afiche'}
        </button>
      </div>
    </section>
  );
}
