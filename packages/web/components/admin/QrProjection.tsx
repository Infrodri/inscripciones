'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export function QrProjection({ sessionId }: { sessionId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    objectUrlRef.current = objectUrl;
  }, [objectUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  async function handleProyectar(): Promise<void> {
    setCargando(true);
    try {
      const res = await api.get<{ url: string; qrPngUrl: string; expiresAt: string }>(
        `/sessions/${sessionId}/self-checkin/token`
      );
      const data = res.data;
      const pngPath = data.qrPngUrl.replace(/^\/api\/v1/, '');

      const imgRes = await api.get<Blob>(pngPath, { responseType: 'blob' });
      const newObjectUrl = URL.createObjectURL(imgRes.data);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      setObjectUrl(newObjectUrl);
      setUrl(data.url);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setCargando(false);
    }
  }

  function cerrar(): void {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
    setUrl(null);
  }

  return (
    <>
      <div className="mt-2">
        <Button
          variant="secundario"
          size="sm"
          onClick={() => void handleProyectar()}
          cargando={cargando}
        >
          Proyectar QR
        </Button>
      </div>

      {objectUrl && (
        <Dialog titulo="QR de asistencia" onCerrar={cerrar}>
          <div className="flex flex-col items-center">
            <img
              src={objectUrl}
              alt="QR de asistencia"
              className="mt-4 h-auto w-full max-w-md rounded-[var(--radius-md)]"
            />
            {url && (
              <p className="mt-4 break-all text-center text-sm text-[var(--color-ink)]">
                {url}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}