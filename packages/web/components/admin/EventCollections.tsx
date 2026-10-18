'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { formatFechaHora } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { SessionScanActions } from '@/components/admin/SessionScanActions';

export function EventCollections({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'session' | 'speaker' | 'sponsor' | null>(null);
  const [sessionAt, setSessionAt] = useState('');
  const [sessionEndsAt, setSessionEndsAt] = useState('');
  const [sessionLocation, setSessionLocation] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [sponsorName, setSponsorName] = useState('');

  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{
      data: Array<{
        id: string;
        startsAt: string;
        endsAt?: string | null;
        location?: string | null;
        label?: string | null;
      }>;
    }> => (await api.get(`/sessions/event/${eventId}`)).data,
  });
  const speakers = useQuery({
    queryKey: ['speakers', eventId],
    queryFn: async (): Promise<{ data: Array<{ id: string; fullName: string; role: string }> }> =>
      (await api.get(`/speakers/event/${eventId}`)).data,
  });
  const sponsors = useQuery({
    queryKey: ['sponsors', eventId],
    queryFn: async (): Promise<{ data: Array<{ id: string; name: string }> }> =>
      (await api.get(`/sponsors/event/${eventId}`)).data,
  });

  async function add(path: string, body: object, keys: string[]): Promise<void> {
    try {
      await api.post(path, body);
      await queryClient.invalidateQueries({ queryKey: keys });
      setDialog(null);
      toast.success('Agregado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <section>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Sesiones / Salas / Mesas</h2>
        <ul className="mt-2 space-y-2">
          {(sessions.data?.data ?? []).map((s) => (
            <li
              key={s.id}
              className="text-sm rounded-[var(--radius-md)] border border-line bg-canvas p-2.5"
            >
              <div className="font-semibold text-navy">{s.label ? s.label : 'Sesión'}</div>
              <div className="text-xs text-muted mt-0.5">
                {formatFechaHora(s.startsAt)}
                {s.location ? ` · Salón/Mesa: ${s.location}` : ''}
              </div>
              <div className="mt-2">
                <SessionScanActions sessionId={s.id} />
              </div>
            </li>
          ))}
        </ul>
        {sessions.isLoading ? <p>Cargando…</p> : null}
        <div className="mt-2">
          <Button variant="secundario" onClick={() => setDialog('session')}>
            Agregar sesión / sala
          </Button>
        </div>
      </section>
      <section>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Expositores</h2>
        <ul className="mt-2 space-y-1">
          {(speakers.data?.data ?? []).map((s) => (
            <li key={s.id} className="text-sm">
              {s.fullName} ({s.role})
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <Button variant="secundario" onClick={() => setDialog('speaker')}>
            Agregar expositor
          </Button>
        </div>
      </section>
      <section>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Auspiciantes</h2>
        <ul className="mt-2 space-y-1">
          {(sponsors.data?.data ?? []).map((s) => (
            <li key={s.id} className="text-sm">
              {s.name}
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <Button variant="secundario" onClick={() => setDialog('sponsor')}>
            Agregar auspiciante
          </Button>
        </div>
      </section>
      {dialog === 'session' ? (
        <Dialog
          titulo="Agregar sesión o sala/mesa"
          onCerrar={() => {
            setDialog(null);
            setSessionAt('');
            setSessionEndsAt('');
            setSessionLocation('');
            setSessionLabel('');
          }}
          accion={
            <Button
              onClick={() =>
                void add(
                  '/sessions',
                  {
                    eventId,
                    startsAt: new Date(sessionAt).toISOString(),
                    endsAt: sessionEndsAt ? new Date(sessionEndsAt).toISOString() : null,
                    location: sessionLocation.trim() || null,
                    label: sessionLabel.trim() || null,
                  },
                  ['sessions', eventId]
                )
              }
            >
              Guardar
            </Button>
          }
        >
          <div className="space-y-3">
            <Input
              id="nueva-sesion-inicio"
              etiqueta="Fecha y hora de inicio"
              type="datetime-local"
              value={sessionAt}
              onChange={(e) => setSessionAt(e.target.value)}
              required
            />
            <Input
              id="nueva-sesion-fin"
              etiqueta="Fecha y hora de fin"
              opcional=" (opcional)"
              type="datetime-local"
              value={sessionEndsAt}
              onChange={(e) => setSessionEndsAt(e.target.value)}
            />
            <Input
              id="nueva-sesion-sala"
              etiqueta="Salón / Sala de la sesión"
              placeholder="Ej. Salón de Honor, Aula Magna"
              opcional=" (opcional)"
              value={sessionLocation}
              onChange={(e) => setSessionLocation(e.target.value)}
            />
            <Input
              id="nueva-sesion-mesa"
              etiqueta="Mesa / Track / Grupo de trabajo"
              placeholder="Ej. Mesa 1: Derecho Penal, Grupo B"
              opcional=" (opcional)"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
            />
          </div>
        </Dialog>
      ) : null}
      {dialog === 'speaker' ? (
        <Dialog
          titulo="Agregar expositor"
          onCerrar={() => setDialog(null)}
          accion={
            <Button
              onClick={() =>
                void add('/speakers', { eventId, fullName: speakerName, role: 'EXPOSITOR' }, [
                  'speakers',
                  eventId,
                ])
              }
            >
              Guardar
            </Button>
          }
        >
          <Input
            id="nuevo-expositor"
            etiqueta="Nombre"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
          />
        </Dialog>
      ) : null}
      {dialog === 'sponsor' ? (
        <Dialog
          titulo="Agregar auspiciante"
          onCerrar={() => setDialog(null)}
          accion={
            <Button
              onClick={() =>
                void add('/sponsors', { eventId, name: sponsorName }, ['sponsors', eventId])
              }
            >
              Guardar
            </Button>
          }
        >
          <Input
            id="nuevo-auspiciante"
            etiqueta="Nombre"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
