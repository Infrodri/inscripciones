'use client';

import { useEffect, useRef, useState } from 'react';
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
  const cargado = useRef(false);

  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    let objectUrl: string | null = null;
    let vivo = true;
    onCargar()
      .then((blob) => {
        if (!vivo) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudo generar');
      });
    return () => {
      vivo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Se carga una vez al abrir el diálogo.
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
      accion={
        <>
          <Button variant="secundario" onClick={descargar} disabled={!url}>
            Descargar
          </Button>
          <Button onClick={imprimir} disabled={!url}>
            Imprimir
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-[#B42318]">
          {error}
        </p>
      ) : !url ? (
        <p>Cargando vista previa…</p>
      ) : (
        <>
          <p className="text-sm text-[#5B6677]">
            Primera página{totalPaginas !== null ? ` de ${totalPaginas}` : ''}.
          </p>
          <iframe
            ref={setFrame}
            src={url}
            title={titulo}
            className="mt-2 h-[60vh] w-full rounded-[8px] border border-[#D9DEE7]"
          />
        </>
      )}
    </Dialog>
  );
}
