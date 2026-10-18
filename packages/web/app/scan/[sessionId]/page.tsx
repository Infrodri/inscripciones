'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage, getToken } from '@/lib/api';
import { PageHeader } from '@/components/ui/Table';
import { toScanResult, type ScanResult } from '@/lib/scan';
import { Button } from '@/components/ui/Button';
import { WalkinForm } from '@/components/WalkinForm';

const QrScanner = dynamic(() => import('@/components/QrScanner').then((m) => m.QrScanner), {
  ssr: false,
});

interface Found {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
}

export default function ScanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<ScanResult>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
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
        setResult(toScanResult(res.data as { firstName: string; lastName: string }, null));
      } catch (error) {
        const apiError = (
          error as { response?: { data?: { error?: { code?: string; message?: string } } } }
        ).response?.data?.error;
        setResult(
          toScanResult(null, {
            code: apiError?.code,
            message: apiError?.message ?? apiErrorMessage(error),
          })
        );
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

  function restart(): void {
    setResult({ kind: 'idle' });
    setScanning(false);
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
      <PageHeader titulo="Registro de asistencia" volverA="/admin/escaner" />
      {result.kind === 'idle' ? (
        <div className="mt-4">
          {scanning ? (
            <QrScanner
              active={scanning}
              onScan={(text) => void checkin({ qrToken: text })}
              onError={(message) => {
                setScanning(false);
                setResult({ kind: 'error', message });
              }}
            />
          ) : (
            <Button
              onClick={() => setScanning(true)}
              className="w-full min-h-[48px] py-4 text-lg !text-white"
            >
              Iniciar escáner
            </Button>
          )}
          <p className="mt-2 text-sm text-muted">
            La cámara se activa solo al pulsar el botón. Apunte al QR del inscrito.
          </p>
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
          <button
            type="button"
            onClick={restart}
            className="mt-6 min-h-[44px] rounded-[var(--radius-md)] bg-white px-6 py-3 font-semibold text-ink shadow-soft hover:bg-canvas transition-colors cursor-pointer"
          >
            Escanear otro
          </button>
        </div>
      )}
      <section className="mt-8">
        <h2 className="font-serif text-lg font-bold text-navy">Búsqueda manual</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o CI"
            className="flex-1 min-h-[44px] rounded-[var(--radius-md)] border border-line bg-surface p-2.5 text-sm text-ink focus-visible:outline-gold shadow-soft"
            aria-label="Buscar inscrito"
          />
          <Button
            type="button"
            variant="secundario"
            size="md"
            onClick={() => void search()}
            className="min-h-[44px] px-4"
          >
            Buscar
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {found.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface p-3 shadow-soft text-sm"
            >
              <span className="text-ink">
                {p.lastName}, {p.firstName} <span className="text-muted">({p.ci})</span>
              </span>
              <Button
                type="button"
                variant="primario"
                size="sm"
                onClick={() => void checkin({ participantId: p.id })}
                className="min-h-[44px] px-4 !text-white"
              >
                Registrar
              </Button>
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
