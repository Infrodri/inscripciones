'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';

interface BulkResult {
  sent: number;
  failed: Array<{ id: string; name: string; error: string }>;
  skippedNoEmail: number;
  pending: number;
  done: boolean;
  limited: boolean;
}

// Envío masivo de certificados por correo, por lotes de 20 con progreso,
// pausa y reanudación. No deja peticiones abiertas: cada lote es una petición.
export function EnvioCorreoCard({
  eventId,
  roleKind,
  contar,
}: {
  eventId: string;
  roleKind: 'ASISTENTE' | 'EXPOSITOR' | 'ORGANIZADOR' | 'OTRO';
  contar: () => Promise<{ enviar: number; sinCorreo: number; yaEnviados: number }>;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [conteo, setConteo] = useState<{
    enviar: number;
    sinCorreo: number;
    yaEnviados: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [summary, setSummary] = useState<BulkResult | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const pausedRef = { current: false };

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<{
      emailCertificates: boolean;
      certificateEmailSubject: string | null;
      certificateEmailBody: string | null;
    }> => (await api.get(`/events/${eventId}`)).data,
  });
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);

  async function saveConfig(next: {
    emailCertificates?: boolean;
    subject?: string;
    body?: string;
  }): Promise<void> {
    try {
      await api.patch(`/events/${eventId}`, {
        ...(next.emailCertificates !== undefined
          ? { emailCertificates: next.emailCertificates }
          : {}),
        ...(next.subject !== undefined ? { certificateEmailSubject: next.subject || null } : {}),
        ...(next.body !== undefined ? { certificateEmailBody: next.body || null } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function testSend(): Promise<void> {
    if (testEmail.trim() === '') {
      toast.error('Indique el correo de prueba');
      return;
    }
    try {
      await api.post(`/events/${eventId}/test-certificate-email`, { email: testEmail.trim() });
      toast.success('Correo de prueba enviado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function runBulk(): Promise<void> {
    setConfirming(false);
    setRunning(true);
    setPaused(false);
    pausedRef.current = false;
    let totalSent = 0;
    let totalFailed = 0;
    let last: BulkResult | null = null;
    for (;;) {
      if (pausedRef.current) break;
      let res: BulkResult;
      try {
        const response = await api.post(`/events/${eventId}/send-certificates`, {
          roleKind,
          scope: 'all',
          offset: 0,
        });
        res = response.data as BulkResult;
      } catch (error) {
        toast.error(apiErrorMessage(error));
        break;
      }
      totalSent += res.sent;
      totalFailed += res.failed.length;
      last = res;
      setProgress({
        sent: totalSent,
        failed: totalFailed,
        total: totalSent + res.pending + res.failed.length,
      });
      if (res.done || res.limited || (res.sent === 0 && res.failed.length > 0)) break;
    }
    setSummary(last);
    setRunning(false);
    await queryClient.invalidateQueries({ queryKey: ['recipients-expositor', eventId] });
    await queryClient.invalidateQueries({ queryKey: ['recipients-organizador', eventId] });
    await queryClient.invalidateQueries({ queryKey: ['participants'] });
  }

  const enabled = event.data?.emailCertificates ?? false;

  return (
    <Card>
      <h2 className="font-serif text-lg text-[#0A2A5E]">Envío por correo</h2>
      <div className="mt-2">
        <Switch
          id="mail-enabled"
          etiqueta="Habilitar envío de certificados por correo"
          checked={enabled}
          onChange={(value) => void saveConfig({ emailCertificates: value })}
        />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Input
          id="mail-subject"
          etiqueta="Asunto"
          opcional=" (vacío = por defecto)"
          value={subject ?? event.data?.certificateEmailSubject ?? ''}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Input
          id="mail-test"
          etiqueta="Correo de prueba"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
        />
      </div>
      <div className="mt-2">
        <Input
          id="mail-body"
          etiqueta="Texto"
          opcional=" (vacío = por defecto; use {nombre}, {evento}, {fecha})"
          multiline
          rows={3}
          value={body ?? event.data?.certificateEmailBody ?? ''}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secundario"
          onClick={() =>
            void saveConfig({
              ...(subject !== null ? { subject } : {}),
              ...(body !== null ? { body } : {}),
            })
          }
        >
          Guardar textos
        </Button>
        <Button variant="secundario" onClick={() => void testSend()}>
          Probar envío
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={!enabled || running}
          onClick={() => {
            setConteo(null);
            setConfirming(true);
            contar()
              .then(setConteo)
              .catch(() => toast.error('No se pudo contar'));
          }}
        >
          Enviar certificados por correo
        </Button>
        {running ? (
          <Button
            variant="secundario"
            onClick={() => {
              pausedRef.current = true;
              setPaused(true);
            }}
          >
            Pausar
          </Button>
        ) : null}
        {!running && paused ? (
          <Button
            onClick={() => {
              setPaused(false);
              void runBulk();
            }}
          >
            Reanudar
          </Button>
        ) : null}
      </div>
      {(running || summary) && progress.total > 0 ? (
        <div className="mt-2" role="status">
          <div className="h-3 overflow-hidden rounded-[8px] bg-[#D9DEE7]">
            <div
              className="h-full bg-[#0A2A5E]"
              style={{
                width: `${Math.round(((progress.sent + progress.failed) / progress.total) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-sm">
            Enviados: {progress.sent} · Fallidos: {progress.failed} · Total: {progress.total}
            {summary?.limited ? ' · Límite diario alcanzado, el resto queda para mañana.' : null}
          </p>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          titulo="Enviar certificados"
          mensaje={
            conteo
              ? `Se enviará a ${conteo.enviar}. Sin correo: ${conteo.sinCorreo}. Ya recibidos: ${conteo.yaEnviados}. ¿Continuar?`
              : 'Contando destinatarios…'
          }
          confirmar="Enviar"
          onConfirmar={() => void runBulk()}
          onCerrar={() => setConfirming(false)}
        />
      ) : null}
    </Card>
  );
}
