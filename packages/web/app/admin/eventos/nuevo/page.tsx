'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export default function NuevoEventoPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [location, setLocation] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: Array<{ id: string; title: string }> }> =>
      (await api.get('/events')).data,
  });

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      let id: string;
      if (duplicateFrom) {
        const res = await api.post(`/events/${duplicateFrom}/duplicate`, {
          title,
          slug,
          daysShift: 1,
        });
        id = (res.data as { id: string }).id;
      } else {
        const res = await api.post('/events', {
          slug,
          title,
          eventKind: 'Conversatorio',
          institution: '',
          organizer: '',
          location,
        });
        id = (res.data as { id: string }).id;
      }
      if (banner) {
        const form = new FormData();
        form.append('banner', banner);
        await api.post(`/events/${id}/banner`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('Evento creado');
      router.push(`/admin/eventos/${id}`);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Nuevo evento</h1>
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
        <div>
          <label htmlFor="duplicateFrom">Duplicar de… (opcional)</label>
          <select
            id="duplicateFrom"
            value={duplicateFrom}
            onChange={(e) => setDuplicateFrom(e.target.value)}
            className="block w-full rounded border p-2"
          >
            <option value="">Evento nuevo</option>
            {(events?.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title">Título</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded border p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="block w-full rounded border p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="location">Lugar</label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="block w-full rounded border p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="banner">Afiche (PNG/JPG/WebP, máx. 10 MB)</label>
          <input
            id="banner"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
            className="block w-full"
          />
        </div>
        <button type="submit" disabled={busy} className="rounded bg-[#0A2A5E] px-6 py-2 text-white">
          {busy ? 'Creando…' : 'Crear evento'}
        </button>
      </form>
    </div>
  );
}
