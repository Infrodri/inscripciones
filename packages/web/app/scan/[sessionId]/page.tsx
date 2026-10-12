'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage, getToken } from '@/lib/api';
import { WalkinForm } from '@/components/WalkinForm';

const QrScanner = dynamic(() => import('@/components/QrScanner').then((m) => m.QrScanner), {
  ssr: false,
});

type Result =
  | { kind: 'idle' }
  | { kind: 'ok'; name: string }
  | { kind: 'dup'; name: string }
  | { kind: 'error'; message: string };

interface Found {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
}

export default function ScanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [scanning, setScanning] = useState(true);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);

  useEffect(() => {
    if (!getToken()) router.replace('/admin/login');
  }, [router]);

  const checkin = useCallback(
    async (body: object) => {
      setScanning(false);
      try {
        const res = await api.post(`/sessions/${sessionId}/check-in`, body);
        setResult({
          kind: 'ok',
          name: `${res.data.firstName as string} ${res.data.lastName as string}`,
        });
      } catch (error) {
        const code = (
          error as { response?: { data?: { error?: { code?: string; message?: string } } } }
        ).response?.data?.error;
        if (code?.code === 'ALREADY_CHECKED_IN')
          setResult({ kind: 'dup', name: code.message ?? '' });
        else setResult({ kind: 'error', message: code?.message ?? apiErrorMessage(error) });
      }
    },
    [sessionId]
  );

  async function search(): Promise<void> {
    try {
      const res = await api.get(`/sessions/${sessionId}/participants/search`, { params: { q } });
      setFound((res.data as { data: Found[] }).data);
    } catch (error) {
      toast.error(apiErrorMessage(error));
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
      <h1 className="font-serif text-xl text-[#0A2A5E]">Registro de asistencia</h1>
      {result.kind === 'idle' ? (
        <div className="mt-4">
          {scanning ? (
            <QrScanner active={scanning} onScan={(text) => void checkin({ qrToken: text })} />
          ) : null}
          <p className="mt-2 text-sm">Apunte la cámara al QR del inscrito.</p>
        </div>
      ) : (
        <div className={`${bg} mt-4 rounded p-8 text-center text-white`}>
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
          <button
            type="button"
            onClick={() => {
              setResult({ kind: 'idle' });
              setScanning(true);
            }}
            className="mt-6 rounded bg-white px-6 py-3 text-black"
          >
            Escanear otro
          </button>
        </div>
      )}
      <section className="mt-8">
        <h2 className="font-serif text-lg">Búsqueda manual</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o CI"
            className="flex-1 rounded border p-2"
            aria-label="Buscar inscrito"
          />
          <button type="button" onClick={() => void search()} className="rounded border px-3">
            Buscar
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {found.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {p.lastName}, {p.firstName} ({p.ci})
              </span>
              <button
                type="button"
                onClick={() => void checkin({ participantId: p.id })}
                className="rounded bg-[#0A2A5E] px-3 py-1 text-white"
              >
                Registrar
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-lg">Inscripción en puerta</h2>
        <WalkinForm sessionId={sessionId} onDone={(name) => setResult({ kind: 'ok', name })} />
      </section>
    </main>
  );
}
