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
  ABIERTAS: 'Inscripciones abiertas',
  CERRADAS_MANUAL: 'Cerradas manualmente',
  CERRADA_FECHA: 'Cerradas por fecha límite',
  CUPO_LLENO: 'Cupo completo',
  BORRADOR: 'Borrador (no publicado)',
  FINALIZADO: 'Evento finalizado',
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
      toast.success(abrir ? 'Inscripciones abiertas exitosamente' : 'Inscripciones cerradas');
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
      toast.success('Inscripciones reabiertas exitosamente');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function saveLimits(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      const cap = capacity !== null ? (capacity === '' ? null : Number(capacity)) : undefined;
      const dl =
        deadline !== null ? (deadline === '' ? null : new Date(deadline).toISOString()) : undefined;
      await api.patch(`/events/${eventId}`, {
        capacity: cap,
        registrationDeadline: dl,
      });
      await refresh();
      toast.success('Límites de inscripción guardados');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (isLoading) return <p className="text-muted">Cargando estado de inscripciones…</p>;
  if (isError || !data) return <p className="text-danger">No se pudo cargar el evento.</p>;

  return (
    <div className="space-y-6">
      <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-navy">Estado de inscripciones</h2>
            <p className="text-xs text-muted">
              Controle si el público puede registrarse al evento en este momento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tono={data.status}>{data.status}</Badge>
            <Badge tono={data.registrationReason === 'ABIERTAS' ? 'ok' : 'aviso'}>
              {REASON_TEXT[data.registrationReason] ?? data.registrationReason}
            </Badge>
          </div>
        </div>

        {data.registrationReason === 'CERRADA_FECHA' && data.registrationDeadline ? (
          <p className="text-sm text-warn">
            ⚠ Las inscripciones cerraron por fecha límite (
            {formatFechaHora(data.registrationDeadline)}).
          </p>
        ) : null}

        <div className="pt-1">
          {data.status === 'ABIERTO' || data.status === 'CERRADO' ? (
            <Switch
              id="insc-abiertas"
              etiqueta={
                data.status === 'ABIERTO'
                  ? 'Inscripciones abiertas al público'
                  : 'Inscripciones cerradas al público'
              }
              checked={data.status === 'ABIERTO'}
              onChange={(value) => void toggle(value)}
            />
          ) : (
            <div className="p-3 bg-canvas rounded-[var(--radius-md)] border border-line text-sm text-muted">
              Estado actual: <strong className="text-ink">{data.status}</strong>. Debe publicar el
              evento para poder abrir las inscripciones.
            </div>
          )}
        </div>
      </Card>

      {reopening ? (
        <Card className="rounded-[12px] border border-warn bg-surface p-6 shadow-soft space-y-4">
          <h2 className="font-serif text-lg font-bold text-navy border-b border-line pb-2">
            Reabrir inscripciones (fecha vencida)
          </h2>
          <p className="text-sm text-muted">
            La fecha límite anterior ya expiró. Configure una nueva fecha y hora para la recepción
            de inscripciones o deshabilite el límite de tiempo.
          </p>
          <form onSubmit={(e) => void confirmReopen(e)} className="space-y-4">
            <Input
              id="reopen-deadline"
              etiqueta="Nueva fecha y hora límite"
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
                className="h-5 w-5 accent-navy cursor-pointer"
              />
              <label
                htmlFor="reopen-nodeadline"
                className="cursor-pointer text-sm font-medium text-ink"
              >
                Sin fecha límite (abierto hasta que se cierre manualmente)
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" variant="primario" className="!text-white">
                Confirmar reapertura
              </Button>
              <Button variant="secundario" onClick={() => setReopening(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <EnrollmentLinkCard slug={data.slug} />

      {data.status === 'BORRADOR' ? (
        <div className="p-3 bg-warn-bg border border-warn rounded-[var(--radius-md)] text-sm text-warn">
          ℹ Aviso: el evento se encuentra en estado borrador. El enlace público mostrará el evento
          pero las inscripciones estarán inactivas hasta su publicación.
        </div>
      ) : null}

      <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft space-y-4">
        <h2 className="font-serif text-lg font-bold text-navy border-b border-line pb-2">
          Cupo y fecha límite de inscripción
        </h2>
        <form onSubmit={(e) => void saveLimits(e)} className="grid gap-4 md:grid-cols-2">
          <Input
            id="insc-cupo"
            etiqueta="Cupo máximo de participantes"
            opcional=" (vacío = sin límite)"
            type="number"
            min={0}
            value={capacity ?? data.capacity?.toString() ?? ''}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Input
            id="insc-limite"
            etiqueta="Fecha y hora límite de inscripción"
            opcional=" (opcional)"
            type="datetime-local"
            value={deadline ?? toLocalInput(data.registrationDeadline)}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" variant="primario" className="!text-white">
              Guardar configuración
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
