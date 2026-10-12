'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
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
}

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<EventRow> => (await api.get(`/events/${eventId}`)).data,
  });

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  }

  async function toggle(abrir: boolean): Promise<void> {
    try {
      await api.post(`/events/${eventId}/${abrir ? 'reopen' : 'close'}`);
      await refresh();
      toast.success(abrir ? 'Inscripciones abiertas' : 'Inscripciones cerradas');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
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
      </Card>
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
