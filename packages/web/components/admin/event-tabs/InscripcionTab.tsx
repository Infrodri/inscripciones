'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { EnrollmentLinkCard } from '@/components/admin/EnrollmentLinkCard';

interface EventRow {
  id: string;
  slug: string;
  status: string;
  capacity: number | null;
  registrationDeadline: string | null;
  registrationReason: string;
}

const REASON_TEXT: Record<string, string> = {
  ABIERTAS: 'Abiertas',
  CERRADAS_MANUAL: 'Cerradas manualmente',
  CERRADA_FECHA: 'Cerradas por fecha límite',
  CUPO_LLENO: 'Cupo lleno',
  BORRADOR: 'Borrador',
  FINALIZADO: 'Finalizado',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InscripcionTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [capacity, setCapacity] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [noDeadline, setNoDeadline] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<EventRow> => (await api.get(`/events/${eventId}`)).data,
  });

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  }

  async function toggle(abrir: boolean): Promise<void> {
    try {
      if (abrir) {
        const expired =
          data?.registrationDeadline && new Date() > new Date(data.registrationDeadline);
        if (expired) {
          setReopening(true);
          return;
        }
        await api.post(`/events/${eventId}/reopen`);
      } else {
        await api.post(`/events/${eventId}/close`);
      }
      await refresh();
      toast.success(abrir ? 'Inscripciones abiertas' : 'Inscripciones cerradas');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function confirmReopen(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!noDeadline && newDeadline === '') {
      toast.error('Elija una nueva fecha límite o marque "Sin fecha límite"');
      return;
    }
    try {
      await api.post(`/events/${eventId}/reopen`, {
        ...(noDeadline ? { removeDeadline: true } : {}),
        ...(!noDeadline && newDeadline !== ''
          ? { registrationDeadline: new Date(newDeadline).toISOString() }
          : {}),
      });
      setReopening(false);
      setNewDeadline('');
      setNoDeadline(false);
      await refresh();
      toast.success('Inscripciones abiertas');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function saveLimits(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await api.patch(`/events/${eventId}`, {
        capacity: capacity === '' || capacity === null ? null : Number(capacity),
        registrationDeadline:
          deadline === '' || deadline === null ? null : new Date(deadline).toISOString(),
      });
      await refresh();
      toast.success('Límites guardados');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (isLoading) return <p>Cargando…</p>;
  if (isError || !data) return <p>No se pudo cargar el evento.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm">
          Estado: <Badge tono={data.status}>{data.status}</Badge>{' '}
          <Badge tono={data.registrationReason === 'ABIERTAS' ? 'ok' : 'aviso'}>
            {REASON_TEXT[data.registrationReason] ?? data.registrationReason}
          </Badge>
        </p>
        {data.registrationReason === 'CERRADA_FECHA' && data.registrationDeadline ? (
          <p className="mt-1 text-sm text-[#5B6677]">
            Cerradas por fecha límite ({formatFechaHora(data.registrationDeadline)})
          </p>
        ) : null}
        <div className="mt-2">
          {data.status === 'ABIERTO' || data.status === 'CERRADO' ? (
            <Switch
              id="insc-abiertas"
              etiqueta={
                data.status === 'ABIERTO' ? 'Inscripciones abiertas' : 'Inscripciones cerradas'
              }
              checked={data.status === 'ABIERTO'}
              onChange={(value) => void toggle(value)}
            />
          ) : (
            <p className="text-sm">
              Estado actual: {data.status}. Publique el evento para abrir inscripciones.
            </p>
          )}
        </div>
      </Card>
      {reopening ? (
        <Card>
          <h2 className="font-serif text-lg text-[#0A2A5E]">Reabrir con fecha vencida</h2>
          <p className="mt-1 text-sm">
            La fecha límite venció. Elija una nueva o márquela sin fecha límite.
          </p>
          <form onSubmit={(e) => void confirmReopen(e)} className="mt-2 space-y-2">
            <Input
              id="reopen-deadline"
              etiqueta="Nueva fecha límite"
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
            <div className="flex min-h-[44px] items-center gap-2">
              <input
                id="reopen-nodeadline"
                type="checkbox"
                checked={noDeadline}
                onChange={(e) => setNoDeadline(e.target.checked)}
                className="h-5 w-5"
              />
              <label htmlFor="reopen-nodeadline">Sin fecha límite</label>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Confirmar reapertura</Button>
              <Button variant="secundario" onClick={() => setReopening(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <EnrollmentLinkCard slug={data.slug} />
      {data.status === 'BORRADOR' ? (
        <p className="text-sm text-[#5B6677]">
          Aviso: el evento aún está en borrador; el enlace funcionará al publicarlo.
        </p>
      ) : null}
      <Card>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Cupo y fecha límite</h2>
        <form onSubmit={(e) => void saveLimits(e)} className="mt-2 grid gap-3 md:grid-cols-2">
          <Input
            id="insc-cupo"
            etiqueta="Cupo"
            opcional=" (vacío = sin límite)"
            type="number"
            min={0}
            value={capacity ?? data.capacity?.toString() ?? ''}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Input
            id="insc-limite"
            etiqueta="Fecha límite"
            opcional=" (opcional)"
            type="datetime-local"
            value={deadline ?? toLocalInput(data.registrationDeadline)}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="md:col-span-2">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
