'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

// Vista previa de PDF en diálogo: blob en visor iframe, Descargar e Imprimir.
export function PdfPreviewDialog({
  titulo,
  totalPaginas,
  onCargar,
  nombreArchivo,
  onCerrar,
}: {
  titulo: string;
  totalPaginas: number | null;
  onCargar: () => Promise<Blob>;
  nombreArchivo: string;
  onCerrar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;

    onCargar()
      .then((blob) => {
        if (!active) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo generar el archivo PDF');
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  function descargar(): void {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
  }

  function imprimir(): void {
    frame?.contentWindow?.print();
  }

  return (
    <Dialog
      titulo={titulo}
      onCerrar={onCerrar}
      maxWidth="max-w-4xl"
      accion={
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              Abrir en pestaña nueva
            </a>
          ) : null}
          <Button variant="secundario" onClick={descargar} disabled={!url}>
            Descargar
          </Button>
          <Button onClick={imprimir} disabled={!url}>
            Imprimir
          </Button>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : !url ? (
        <p className="text-sm text-muted">Cargando vista previa…</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Primera página{totalPaginas !== null ? ` de ${totalPaginas}` : ''}.
          </p>
          <iframe
            ref={setFrame}
            src={url}
            title={titulo}
            className="mt-2 h-[65vh] w-full rounded-[var(--radius-md)] border border-line bg-surface"
          />
        </>
      )}
    </Dialog>
  );
}
