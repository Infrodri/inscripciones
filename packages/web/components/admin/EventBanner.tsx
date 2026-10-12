'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FileDropzone } from '@/components/ui/FileDropzone';

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
      <div className="mt-2 max-w-md space-y-2">
        <FileDropzone
          etiqueta="Archivo del afiche (PNG/JPG/WebP, máx. 10 MB)"
          acepta="image/png,image/jpeg,image/webp"
          archivo={file}
          onArchivo={setFile}
          progreso={null}
        />
        <Button onClick={() => void upload()} disabled={!file} cargando={busy}>
          Subir afiche
        </Button>
      </div>
    </section>
  );
}
