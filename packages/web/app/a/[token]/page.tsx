'use client';

import axios from 'axios';
import { use, useEffect, useState } from 'react';
import { apiBaseUrl, configErrorMessage } from '@/lib/api';
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
      ? 'bg-green-600'
      : result.kind === 'dup'
        ? 'bg-amber-500'
        : result.kind === 'error'
          ? 'bg-red-600'
          : '';

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Registro de asistencia</h1>
      {loadError ? (
        <p role="alert" className="mt-4 rounded bg-red-600 p-6 text-center text-lg text-white">
          {loadError}
        </p>
      ) : !info ? (
        <p className="mt-4">Cargando…</p>
      ) : result.kind === 'idle' ? (
        <div className="mt-4">
          <p className="font-medium">{info.title}</p>
          <p className="mt-1 text-sm">{formatLaPaz(info.startsAt)}</p>
          {!info.open ? (
            <p role="alert" className="mt-3 rounded border border-[#C9A227] p-2 text-sm">
              El registro por QR aún no está abierto. Espere la indicación del salón.
            </p>
          ) : null}
          <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
            <div>
              <label htmlFor="ci">CI</label>
              <input
                id="ci"
                value={ci}
                onChange={(e) => setCi(e.target.value)}
                className="block w-full rounded border p-3 text-lg"
                required
                autoComplete="off"
                inputMode="text"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !info.open}
              className="min-h-[48px] w-full rounded bg-[#0A2A5E] px-6 py-3 text-lg text-white disabled:opacity-50"
            >
              {busy ? 'Registrando…' : 'Registrar mi asistencia'}
            </button>
          </form>
        </div>
      ) : (
        <div className={`${bg} mt-4 rounded p-8 text-center text-white`} role="status">
          {result.kind === 'ok' ? (
            <>
              <p className="text-2xl">Registrado</p>
              <p className="mt-2 text-xl">{result.name}</p>
            </>
          ) : result.kind === 'dup' ? (
            <>
              <p className="text-2xl">Ya registrado</p>
              <p className="mt-2">{result.name}</p>
            </>
          ) : (
            <>
              <p className="text-2xl">No válido</p>
              <p className="mt-2">{result.message}</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
