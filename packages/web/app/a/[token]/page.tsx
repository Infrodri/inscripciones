'use client';

import axios from 'axios';
import { use, useEffect, useState } from 'react';
import { apiBaseUrl, configErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { formatLaPaz } from '@/lib/scanWindow';

type Result =
  | { kind: 'idle' }
  | { kind: 'ok'; name: string }
  | { kind: 'dup'; name: string }
  | { kind: 'error'; message: string };

interface SelfCheckinInfo {
  title: string;
  startsAt: string;
  endsAt: string | null;
  open: boolean;
}

const base = (): string => apiBaseUrl();

// Auto-registro por QR de sala: mobile-first, un campo CI.
export default function AutoCheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<SelfCheckinInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ci, setCi] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base()}/public/self-checkin/${token}`);
        if (!res.ok) throw new Error('El código QR no es válido');
        if (!cancelled) setInfo((await res.json()) as SelfCheckinInfo);
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'El código QR no es válido');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await axios.post(`${base()}/public/self-checkin`, { token, ci });
      const data = res.data as { firstName: string; lastInitial: string };
      setResult({ kind: 'ok', name: `${data.firstName} ${data.lastInitial}` });
    } catch (error) {
      const configMessage = configErrorMessage(error);
      if (configMessage) {
        setResult({ kind: 'error', message: configMessage });
      } else if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error as
          | { code?: string; message?: string }
          | undefined;
        if (apiError?.code === 'ALREADY_CHECKED_IN') {
          setResult({ kind: 'dup', name: apiError.message ?? '' });
        } else {
          setResult({ kind: 'error', message: apiError?.message ?? 'No se pudo registrar' });
        }
      } else {
        setResult({ kind: 'error', message: 'No se pudo registrar' });
      }
    } finally {
      setBusy(false);
    }
  }

  const bg =
    result.kind === 'ok'
      ? 'bg-ok'
      : result.kind === 'dup'
        ? 'bg-warn'
        : result.kind === 'error'
          ? 'bg-danger'
          : '';

  return (
    <main className="mx-auto max-w-md p-4 overflow-x-hidden">
      <h1 className="font-serif text-2xl font-bold text-navy">Registro de asistencia</h1>
      {loadError ? (
        <p
          role="alert"
          className="mt-4 rounded-[var(--radius-md)] bg-danger p-6 text-center text-lg text-white shadow-soft"
        >
          {loadError}
        </p>
      ) : !info ? (
        <p className="mt-4 text-muted">Cargando…</p>
      ) : result.kind === 'idle' ? (
        <div className="mt-4">
          <p className="font-medium text-ink">{info.title}</p>
          <p className="mt-1 text-sm text-muted">{formatLaPaz(info.startsAt)}</p>
          {!info.open ? (
            <div
              role="alert"
              className="mt-3 rounded-[var(--radius-md)] border border-gold bg-warn-bg p-3 text-ink shadow-soft"
            >
              <p className="font-medium text-warn">El registro por QR está cerrado por ahora.</p>
              <p className="mt-1 text-sm text-muted">
                Quédese en esta pantalla: el encargado lo abrirá en cualquier momento y podrá
                registrarse sin recargar.
              </p>
            </div>
          ) : null}
          <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
            <div>
              <label htmlFor="ci" className="block text-sm font-medium text-ink mb-1">
                Número de C.I.
              </label>
              <input
                id="ci"
                value={ci}
                onChange={(e) => setCi(e.target.value)}
                className="block w-full min-h-[44px] rounded-[var(--radius-md)] border border-line bg-surface p-3 text-lg text-ink focus-visible:outline-gold shadow-soft"
                required
                autoComplete="off"
                inputMode="text"
                placeholder="Ingrese su C.I."
              />
            </div>
            <Button
              type="submit"
              cargando={busy}
              disabled={busy || !info.open}
              className="w-full min-h-[48px] py-3 text-lg !text-white font-semibold shadow-soft"
            >
              Registrar mi asistencia
            </Button>
          </form>
        </div>
      ) : (
        <div
          className={`${bg} mt-4 rounded-[var(--radius-md)] p-8 text-center text-white shadow-soft`}
          role="status"
        >
          {result.kind === 'ok' ? (
            <>
              <p className="text-2xl font-bold">Registrado</p>
              <p className="mt-2 text-xl">{result.name}</p>
            </>
          ) : result.kind === 'dup' ? (
            <>
              <p className="text-2xl font-bold">Ya registrado</p>
              <p className="mt-2">{result.name}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">No válido</p>
              <p className="mt-2">{result.message}</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
