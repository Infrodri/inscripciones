'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { formatRangoSesion } from '@/lib/format';

export interface EnrichedSession {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  label: string | null;
  selfCheckinOpen?: boolean;
  checkedIn: number;
  event: {
    id: string;
    title: string;
    status: string;
    checkinWindowMinutes: number;
  };
}

export interface ProyectarModalProps {
  open?: boolean;
  session: EnrichedSession | null;
  onCerrar: () => void;
  onSelfCheckinToggle?: (sessionId: string, newOpenState: boolean) => void;
}

export function ProyectarModal(props: ProyectarModalProps) {
  if (props.open === false || !props.session) return null;
  return <ProyectarModalInner {...props} session={props.session} />;
}

function ProyectarModalInner({
  session,
  onCerrar,
  onSelfCheckinToggle,
}: {
  session: EnrichedSession;
  open?: boolean;
  onCerrar: () => void;
  onSelfCheckinToggle?: (sessionId: string, newOpenState: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [cargandoQr, setCargandoQr] = useState(true);
  const [selfCheckinOpen, setSelfCheckinOpen] = useState(Boolean(session.selfCheckinOpen));
  const [actualizandoCheckin, setActualizandoCheckin] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState<number>(session.checkedIn);

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCerrar();
      }
    };

    const handleFocus = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.contains(e.target as Node)) return;

      const targetElement = e.target as HTMLElement | null;
      if (
        targetElement?.closest?.('[role="dialog"]') ||
        targetElement?.closest?.('[role="alertdialog"]') ||
        targetElement?.closest?.('[aria-modal="true"]')
      ) {
        return;
      }

      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (dialogs.length > 1 && dialogs[dialogs.length - 1] !== dialog) {
        return;
      }

      e.preventDefault();
      dialog.focus();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focus', handleFocus, true);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [onCerrar]);

  const cargarQr = useCallback(async () => {
    setCargandoQr(true);
    try {
      const res = await api.get<{ qrPngUrl: string; url: string }>(
        `/sessions/${session.id}/self-checkin/token`
      );
      const pngPath = res.data.qrPngUrl.replace(/^\/api\/v1/, '');
      const imgRes = await api.get<Blob>(pngPath, { responseType: 'blob' });
      const newUrl = URL.createObjectURL(imgRes.data);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = newUrl;
      setQrBlobUrl(newUrl);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCargandoQr(false);
    }
  }, [session.id]);

  const refrescarEstado = useCallback(async () => {
    try {
      const sessionRes = (await api.get(`/sessions/${session.id}`)).data as {
        selfCheckinOpen: boolean;
      };
      setSelfCheckinOpen(sessionRes.selfCheckinOpen);

      const statsRes = (await api.get(`/events/${session.event.id}/stats`).catch(() => null))?.data as
        | { perSession?: Array<{ id: string; checkedIn: number }> }
        | undefined;
      const count = statsRes?.perSession?.find((ps) => ps.id === session.id)?.checkedIn;
      if (typeof count === 'number') {
        setCheckedInCount(count);
      }
    } catch {
      // Endpoint fallback
    }
  }, [session.id, session.event.id]);

  useEffect(() => {
    void cargarQr();
    void refrescarEstado();

    const qrInterval = setInterval(() => {
      void cargarQr();
    }, 45_000);

    const statsInterval = setInterval(() => {
      void refrescarEstado();
    }, 10_000);

    return () => {
      clearInterval(qrInterval);
      clearInterval(statsInterval);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [cargarQr, refrescarEstado]);

  async function handleToggleSelfCheckin(nuevoEstado: boolean): Promise<void> {
    setActualizandoCheckin(true);
    try {
      await api.post(`/sessions/${session.id}/self-checkin/${nuevoEstado ? 'open' : 'close'}`);
      setSelfCheckinOpen(nuevoEstado);
      onSelfCheckinToggle?.(session.id, nuevoEstado);
      toast.success(nuevoEstado ? 'Auto-registro por QR abierto' : 'Auto-registro por QR cerrado');
      await cargarQr();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setActualizandoCheckin(false);
    }
  }

  function handleDescargarQr(): void {
    if (!qrBlobUrl) return;
    const a = document.createElement('a');
    a.href = qrBlobUrl;
    const safeTitle = (session.label || session.event.title)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    a.download = `qr-${safeTitle}-${session.id.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Código QR descargado');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-qr-titulo"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft focus:outline-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Proyección de Asistencia
            </span>
            <h2 id="modal-qr-titulo" className="font-serif text-xl font-bold text-navy">
              {session.label || 'Sesión General'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tono={session.event.status}>{session.event.title}</Badge>
              <span className="text-xs text-muted">
                {formatRangoSesion(session.startsAt, session.endsAt)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] border border-line text-muted hover:bg-canvas hover:text-ink transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Self-checkin switch card */}
        <div className="mt-4 rounded-[var(--radius-md)] border border-line bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Auto-registro de asistentes</p>
              <p className="text-xs text-muted">
                {selfCheckinOpen
                  ? 'Abierto: Los participantes pueden escanear el QR desde sus teléfonos'
                  : 'Cerrado: Nadie puede auto-registrarse hasta que abras el registro'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tono={selfCheckinOpen ? 'ok' : 'CERRADO'}>
                {selfCheckinOpen ? 'Abierto' : 'Cerrado'}
              </Badge>
              <button
                type="button"
                role="switch"
                aria-checked={selfCheckinOpen}
                disabled={actualizandoCheckin}
                onClick={() => void handleToggleSelfCheckin(!selfCheckinOpen)}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50',
                  selfCheckinOpen ? 'bg-navy' : 'bg-line'
                )}
              >
                <span className="sr-only">Alternar estado de auto-registro</span>
                <span
                  className={cn(
                    'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface shadow-soft ring-0 transition duration-200 ease-in-out',
                    selfCheckinOpen ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted">
            Asistentes registrados en esta sesión:{' '}
            <strong className="text-ink">{checkedInCount}</strong>
          </div>
        </div>

        {/* QR Display */}
        <div className="mt-4 flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface p-6 text-center">
          {cargandoQr && !qrBlobUrl ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-muted">Generando código QR seguro…</p>
            </div>
          ) : qrBlobUrl ? (
            <div className="flex flex-col items-center">
              <div className="rounded-[var(--radius-md)] border-2 border-gold/40 p-2 bg-surface shadow-soft">
                <img
                  src={qrBlobUrl}
                  alt={`Código QR de sesión ${session.label || ''}`}
                  className="h-64 w-64 object-contain"
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                Este código se regenera automáticamente cada 45 segundos para prevenir duplicaciones.
              </p>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <p className="text-sm text-danger">No se pudo cargar el código QR.</p>
              <Button variant="secundario" size="sm" onClick={() => void cargarQr()}>
                Reintentar
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button
            variant="secundario"
            size="sm"
            onClick={handleDescargarQr}
            disabled={!qrBlobUrl}
          >
            Descargar imagen QR
          </Button>
          <Button variant="secundario" size="sm" asChild>
            <a href={`/scan/${session.id}/proyectar`}>
              Pantalla completa para proyector
            </a>
          </Button>
          <Button variant="fantasma" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
