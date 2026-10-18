'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function EventBanner({ eventId, slug }: { eventId: string; slug: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Afiche subido correctamente');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner(): Promise<void> {
    setBusy(true);
    try {
      await api.delete(`/events/${eventId}/banner`);
      await queryClient.invalidateQueries({ queryKey: ['public-event', slug] });
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      setShowDeleteConfirm(false);
      toast.success('Afiche quitado. Se utilizará la imagen institucional por defecto.');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="afiche"
      aria-label="Afiche del evento"
      className="rounded-[var(--radius-md)] border border-line bg-surface p-5 shadow-soft space-y-4"
    >
      <div>
        <h2 className="font-serif text-lg font-bold text-navy">
          Afiche y cabecera de credenciales
        </h2>
        <p className="mt-1 text-sm text-muted">
          El afiche subido se muestra en el portal público del evento y se utiliza automáticamente como cabecera gráfica superior en las credenciales impresas (badges). Si no se sube un afiche o se quita, el sistema usa automáticamente la fotografía institucional de la Facultad.
        </p>
      </div>

      {data?.bannerUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              Afiche activo
            </span>
          </div>
          <img
            src={data.bannerUrl}
            alt="Afiche del evento"
            className="max-h-64 rounded-[var(--radius-md)] border border-line object-contain bg-canvas"
          />
          <div>
            <Button
              type="button"
              variant="peligro"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              cargando={busy}
            >
              Quitar afiche (volver a imagen institucional por defecto)
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-line/60 bg-canvas/50 p-3 text-sm text-muted">
          <p className="font-medium text-ink">Sin afiche personalizado</p>
          <p className="text-xs mt-0.5">
            Actualmente la página pública y las credenciales están usando el fondo y encabezado institucional de la Facultad por defecto.
          </p>
        </div>
      )}

      <div className="max-w-md space-y-2 pt-2 border-t border-line/60">
        <FileDropzone
          etiqueta="Subir nuevo afiche (PNG/JPG/WebP, máx. 10 MB)"
          acepta="image/png,image/jpeg,image/webp"
          archivo={file}
          onArchivo={setFile}
          progreso={null}
        />
        <Button
          type="button"
          variant="primario"
          onClick={() => void upload()}
          disabled={!file}
          cargando={busy}
          className="!text-white"
        >
          {data?.bannerUrl ? 'Reemplazar afiche' : 'Subir afiche'}
        </Button>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          open={true}
          titulo="Quitar afiche"
          mensaje="¿Deseas quitar este afiche? La página pública y las credenciales pasarán a mostrar la cabecera institucional por defecto de la Facultad."
          confirmar="Quitar afiche"
          onConfirmar={() => void removeBanner()}
          onCerrar={() => setShowDeleteConfirm(false)}
        />
      )}
    </section>
  );
}

