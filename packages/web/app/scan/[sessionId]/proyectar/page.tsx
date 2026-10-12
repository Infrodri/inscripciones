'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, apiErrorMessage, getToken } from '@/lib/api';

// Pantalla para proyectar: QR enorme que se regenera cada 45 s sin recargar.
export default function ProyectarPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getToken()) router.replace('/admin/login');
  }, [router]);

  const refreshQr = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${sessionId}/self-checkin/token`);
      const data = res.data as { qrPngUrl: string };
      const img = await api.get(data.qrPngUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(img.data as Blob);
      setQrUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }, [sessionId]);

  const refreshState = useCallback(async () => {
    try {
      const session = (await api.get(`/sessions/${sessionId}`)).data as {
        eventId: string;
        selfCheckinOpen: boolean;
      };
      const stats = (await api.get(`/events/${session.eventId}/stats`)).data as {
        perSession: Array<{ id: string; checkedIn: number }>;
      };
      setOpen(session.selfCheckinOpen);
      setCount(stats.perSession.find((s) => s.id === sessionId)?.checkedIn ?? null);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshQr();
    void refreshState();
    const qrTimer = setInterval(() => void refreshQr(), 45_000);
    const countTimer = setInterval(() => void refreshState(), 10_000);
    return () => {
      clearInterval(qrTimer);
      clearInterval(countTimer);
    };
  }, [refreshQr, refreshState]);

  async function setRegistration(value: boolean): Promise<void> {
    try {
      await api.post(`/sessions/${sessionId}/self-checkin/${value ? 'open' : 'close'}`);
      await refreshState();
      toast.success(value ? 'Registro abierto' : 'Registro cerrado');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-6 text-center">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Registro por QR</h1>
      {qrUrl ? (
        <img src={qrUrl} alt="QR de registro" className="mt-4 w-full max-w-md" />
      ) : (
        <p className="mt-4">Cargando código…</p>
      )}
      <p className="mt-4 text-xl">
        Registrados: <strong>{count ?? '…'}</strong>
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => void setRegistration(true)}
          disabled={open !== false}
          className="min-h-[44px] rounded bg-[#0A2A5E] px-6 py-3 text-lg text-white disabled:opacity-50"
        >
          Abrir registro
        </button>
        <button
          type="button"
          onClick={() => void setRegistration(false)}
          disabled={open !== true}
          className="min-h-[44px] rounded border border-[#C9A227] px-6 py-3 text-lg"
        >
          Cerrar registro
        </button>
      </div>
      {open === false ? <p className="mt-2 text-sm">El registro está cerrado.</p> : null}
    </main>
  );
}
