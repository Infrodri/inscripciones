'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { TemplateEditor } from '@/components/admin/TemplateEditor';

export interface Template {
  id: string;
  roleKind: string;
  name: string;
  isDefault: boolean;
}

const DEFAULT_BOX = {
  xPct: 10,
  yPct: 45,
  wPct: 80,
  hPct: 12,
  fontKey: 'serif',
  sizePt: 48,
  color: '#000000',
  align: 'left',
  nameCase: 'TITLE',
  autoShrink: true,
};

export function TemplateManager({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [roleKind, setRoleKind] = useState('ASISTENTE');

  const { data, isLoading } = useQuery({
    queryKey: ['templates', eventId],
    queryFn: async (): Promise<{ data: Template[] }> =>
      (await api.get(`/events/${eventId}/certificate-templates`)).data,
  });

  async function upload(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      form.append('roleKind', roleKind);
      form.append('nameBox', JSON.stringify(DEFAULT_BOX));
      await api.post(`/events/${eventId}/certificate-templates/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      toast.success('Plantilla subida');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function setDefault(id: string): Promise<void> {
    await api.post(`/certificate-templates/${id}/set-default`);
    await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
  }

  if (isLoading) return <p>Cargando plantillas…</p>;
  return (
    <div>
      <h2 className="font-serif text-lg">Subir plantilla (PNG/JPG, máx. 15 MB)</h2>
      <form onSubmit={(e) => void upload(e)} className="mt-2 flex flex-wrap items-end gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label="Imagen de plantilla"
          required
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          required
          className="rounded border p-1"
          aria-label="Nombre de plantilla"
        />
        <select
          value={roleKind}
          onChange={(e) => setRoleKind(e.target.value)}
          className="rounded border p-1"
          aria-label="Rol"
        >
          <option value="ASISTENTE">Asistente</option>
          <option value="EXPOSITOR">Expositor</option>
          <option value="ORGANIZADOR">Organizador</option>
          <option value="OTRO">Otro</option>
        </select>
        <button type="submit" className="rounded bg-[#0A2A5E] px-3 py-1 text-white">
          Subir
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {(data?.data ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded border p-2">
            <span className="text-sm">
              {t.name} ({t.roleKind}){t.isDefault ? ' — predeterminada' : ''}
            </span>
            <button
              type="button"
              onClick={() => setSelected(t.id)}
              className="rounded border px-2 py-1 text-sm"
            >
              Editar caja
            </button>
            {!t.isDefault ? (
              <button
                type="button"
                onClick={() => void setDefault(t.id)}
                className="rounded border px-2 py-1 text-sm"
              >
                Predeterminada
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {selected ? <TemplateEditor templateId={selected} eventId={eventId} /> : null}
    </div>
  );
}
