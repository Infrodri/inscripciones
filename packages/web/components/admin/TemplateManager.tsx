'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getSessionUser, getToken } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Table';
import { Switch } from '@/components/ui/Switch';
import { TemplateEditor } from '@/components/admin/TemplateEditor';
import { ImportTemplateDialog } from '@/components/admin/ImportTemplateDialog';

export interface Template {
  id: string;
  roleKind: string;
  name: string;
  isDefault: boolean;
  isShared: boolean;
  filePath: string;
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
  const [progress, setProgress] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [importing, setImporting] = useState(false);
  const isAdmin = getSessionUser()?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['templates', eventId],
    queryFn: async (): Promise<{ data: Template[] }> =>
      (await api.get(`/events/${eventId}/certificate-templates`)).data,
  });

  async function upload(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!file) {
      toast.error('Elija la imagen de la plantilla');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('La plantilla supera los 15 MB');
      return;
    }
    setProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      form.append('roleKind', roleKind);
      form.append('nameBox', JSON.stringify(DEFAULT_BOX));
      await api.post(`/events/${eventId}/certificate-templates/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        },
      });
      setFile(null);
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      toast.success('Plantilla subida');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  async function setDefault(id: string): Promise<void> {
    await api.post(`/certificate-templates/${id}/set-default`);
    await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
  }

  async function toggleShared(template: Template, value: boolean): Promise<void> {
    try {
      await api.patch(`/certificate-templates/${template.id}`, { isShared: value });
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      toast.success(value ? 'Disponible para otros eventos' : 'Ya no se comparte');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function removeTemplate(template: Template): Promise<void> {
    try {
      await api.delete(`/certificate-templates/${template.id}`);
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      if (selected === template.id) setSelected(null);
      toast.success('Plantilla eliminada');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setToDelete(null);
    }
  }

  if (isLoading) return <p>Cargando plantillas…</p>;
  const items = data?.data ?? [];
  return (
    <div>
      <h2 className="font-serif text-lg">Subir plantilla (PNG/JPG, máx. 15 MB)</h2>
      <form onSubmit={(e) => void upload(e)} className="mt-2 max-w-xl space-y-3">
        <FileDropzone
          etiqueta="Imagen de plantilla"
          acepta="image/png,image/jpeg"
          archivo={file}
          onArchivo={setFile}
          progreso={progress}
        />
        <Input
          id="tpl-nombre"
          etiqueta="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="tpl-rol"
          etiqueta="Rol"
          desplegable
          value={roleKind}
          onChange={(e) => setRoleKind(e.target.value)}
        >
          <option value="ASISTENTE">Asistente</option>
          <option value="EXPOSITOR">Expositor</option>
          <option value="ORGANIZADOR">Organizador</option>
          <option value="OTRO">Otro</option>
        </Input>
        <Button type="submit">Subir</Button>
      </form>
      {progress !== null ? (
        <p role="status" className="mt-2 text-sm">
          Subiendo… {progress}%
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {isAdmin ? (
          <Button variant="secundario" onClick={() => setImporting(true)}>
            Importar de otro evento
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState mensaje="Este evento aún no tiene plantillas. Cada evento tiene las suyas: súbalas aquí o importe copias de otro evento." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <Card key={t.id}>
              <TemplateThumb templateId={t.id} name={t.name} />
              <p className="mt-2 text-sm font-medium">
                {t.name} ({t.roleKind})
              </p>
              <p className="mt-1 flex flex-wrap gap-2">
                {t.isDefault ? <Badge tono="ok">Predeterminada</Badge> : null}
                {t.isShared ? <Badge tono="aviso">Compartida</Badge> : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secundario" onClick={() => setSelected(t.id)}>
                  Editar caja
                </Button>
                {!t.isDefault ? (
                  <Button variant="secundario" onClick={() => void setDefault(t.id)}>
                    Predeterminada
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Button variant="secundario" onClick={() => setToDelete(t)}>
                    Eliminar
                  </Button>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="mt-2">
                  <Switch
                    id={`shared-${t.id}`}
                    etiqueta="Disponible para otros eventos"
                    checked={t.isShared}
                    onChange={(value) => void toggleShared(t, value)}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      {selected ? <TemplateEditor templateId={selected} eventId={eventId} /> : null}
      {toDelete ? (
        <ConfirmDialog
          titulo="Eliminar plantilla"
          mensaje={`¿Eliminar "${toDelete.name}"? Si otra plantilla usa la misma imagen, el archivo se conserva.`}
          confirmar="Eliminar"
          onConfirmar={() => void removeTemplate(toDelete)}
          onCerrar={() => setToDelete(null)}
        />
      ) : null}
      {importing ? (
        <ImportTemplateDialog eventId={eventId} onClose={() => setImporting(false)} />
      ) : null}
    </div>
  );
}

function TemplateThumb({ templateId, name }: { templateId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetch(apiUrl(`/certificate-templates/${templateId}/file`), {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        objectUrl = URL.createObjectURL(await res.blob());
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [templateId]);
  if (!url) return <p className="text-sm text-[#5B6677]">Cargando miniatura…</p>;
  return <img src={url} alt={`Miniatura de ${name}`} className="max-h-32 rounded border" />;
}
