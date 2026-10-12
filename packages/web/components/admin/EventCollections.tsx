'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export function EventCollections({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [sessionAt, setSessionAt] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [sponsorName, setSponsorName] = useState('');

  const sessions = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: async (): Promise<{
      data: Array<{ id: string; startsAt: string; label: string | null }>;
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
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <section>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Sesiones</h2>
        <ul className="mt-2 space-y-1">
          {(sessions.data?.data ?? []).map((s) => (
            <li key={s.id} className="text-sm">
              {new Date(s.startsAt).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
            </li>
          ))}
        </ul>
        {sessions.isLoading ? <p>Cargando…</p> : null}
        <div className="mt-2 flex gap-2">
          <input
            type="datetime-local"
            value={sessionAt}
            onChange={(e) => setSessionAt(e.target.value)}
            className="rounded border p-1"
            aria-label="Fecha de sesión"
          />
          <button
            type="button"
            onClick={() =>
              void add('/sessions', { eventId, startsAt: new Date(sessionAt).toISOString() }, [
                'sessions',
                eventId,
              ])
            }
            className="rounded border px-2"
          >
            Añadir
          </button>
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
        <div className="mt-2 flex gap-2">
          <input
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            placeholder="Nombre"
            className="rounded border p-1"
            aria-label="Nombre del expositor"
          />
          <button
            type="button"
            onClick={() =>
              void add('/speakers', { eventId, fullName: speakerName, role: 'EXPOSITOR' }, [
                'speakers',
                eventId,
              ])
            }
            className="rounded border px-2"
          >
            Añadir
          </button>
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
        <div className="mt-2 flex gap-2">
          <input
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="Nombre"
            className="rounded border p-1"
            aria-label="Nombre del auspiciante"
          />
          <button
            type="button"
            onClick={() =>
              void add('/sponsors', { eventId, name: sponsorName }, ['sponsors', eventId])
            }
            className="rounded border px-2"
          >
            Añadir
          </button>
        </div>
      </section>
    </div>
  );
}
