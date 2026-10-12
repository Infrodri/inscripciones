'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export function WalkinForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: (name: string) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ci, setCi] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      const session = (await api.get(`/sessions/${sessionId}`)).data as { eventId: string };
      const res = await api.post(`/events/${session.eventId}/participants`, {
        firstName,
        lastName,
        ci,
        email: email.trim() !== '' ? email : undefined,
        type: 'PUBLICO',
        sessionId,
      });
      onDone(`${res.data.firstName as string} ${res.data.lastName as string}`);
      setFirstName('');
      setLastName('');
      setCi('');
      setEmail('');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Nombres"
          required
          className="rounded border p-2"
          aria-label="Nombres"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Apellidos"
          required
          className="rounded border p-2"
          aria-label="Apellidos"
        />
        <input
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          placeholder="CI"
          required
          className="rounded border p-2"
          aria-label="CI"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Correo (opcional)"
          className="rounded border p-2"
          aria-label="Correo (opcional)"
        />
      </div>
      <button type="submit" disabled={busy} className="rounded bg-[#0A2A5E] px-4 py-2 text-white">
        {busy ? 'Inscribiendo…' : 'Inscribir en puerta'}
      </button>
    </form>
  );
}
