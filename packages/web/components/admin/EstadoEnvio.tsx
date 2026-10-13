'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';

// Estado de envío por persona: enviado / falló (reintentar) / sin correo.
export function EstadoEnvio({
  recipientId,
  email,
  emailedAt,
  error,
  queryKey,
}: {
  recipientId: string;
  email: string | null;
  emailedAt: string | null;
  error: string | null;
  queryKey: string[];
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function send(): Promise<void> {
    setBusy(true);
    try {
      await api.post(`/certificate-recipients/${recipientId}/send-certificate`);
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Certificado enviado');
    } catch (err) {
      toast.error(apiErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey });
    } finally {
      setBusy(false);
    }
  }

  if (!email) return <span className="text-[#5B6677]">Sin correo</span>;
  if (emailedAt)
    return <span className="text-[#1E7B4F]">Enviado {formatFechaHora(emailedAt)}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-[#B42318]">Falló: {error}</span> : null}
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy}
        className="min-h-[44px] rounded-[8px] border border-[#D9DEE7] px-2 py-1 disabled:opacity-50"
      >
        {error ? 'Reintentar' : 'Enviar por correo'}
      </button>
    </span>
  );
}
